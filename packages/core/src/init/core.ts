import { bootStrapExpress } from '../routes'
const Future = require('fibers/future');
const objectql = require("@steedos/objectql");
const steedosAuth = require("@steedos/auth");
const steedosProcess = require("@steedos/process");
const express = require('express');
const graphqlHTTP = require('express-graphql');
const _ = require("underscore");
const app = express();
const routersApp = express();
const router = express.Router();
var path = require('path');
import fs = require('fs')

import { Publish } from '../publish'
import { getSteedosSchema, extend } from '@steedos/objectql';
import { coreExpress } from '../express-middleware'

import { createHash } from "crypto";

export const sha1 = (contents) => {
    var hash = createHash('sha1');
    hash.update(contents);
    return hash.digest('hex');
};

const extendSimpleSchema = () => {
    SimpleSchema.extendOptions({
        filtersFunction: Match.Optional(Match.OneOf(Function, String))
    });
    SimpleSchema.extendOptions({
        optionsFunction: Match.Optional(Match.OneOf(Function, String))
    });
    SimpleSchema.extendOptions({
        createFunction: Match.Optional(Match.OneOf(Function, String))
    });
}

export const initCreator = async () => {
    let allObjects = await objectql.getDataSource('meteor').getObjects();
    await Future.task(() => {
        try {
            extendSimpleSchema();
            Creator.baseObject = objectql.getObjectConfig(objectql.MONGO_BASE_OBJECT);
            Creator.steedosSchema = getSteedosSchema()
            // 不需要加载 Creator 中定义的objects
            // _.each(Creator.Objects, function (obj, object_name) {
            //     obj.name = object_name
            //     objectql.addObjectConfig(obj, 'default')
            // });
            objectql.addAppConfigFiles(path.join(process.cwd(), "src/**")) //TODO await
            // let allObjects = objectql.getObjectConfigs('meteor');
            _.each(allObjects, function (obj) {
                const objectConfig = obj.metadata;
                const localObjectConfig = objectql.getObjectConfig(objectConfig.name);
                if(localObjectConfig){
                    objectConfig.listeners = localObjectConfig.listeners;
                    objectConfig.methods = localObjectConfig.methods;
                    objectConfig.triggers = localObjectConfig.triggers;
                    extend(objectConfig, {triggers: localObjectConfig._baseTriggers})
                }
                Creator.Objects[objectConfig.name] = objectConfig;
            });

            // let allApps = objectql.getAppConfigs();
            // _.each(allApps, function (app) {
            //     if (!app._id)
            //         app._id = app.name
            //     Creator.Apps[app._id] = app
            // });

            let allDashboards = objectql.getDashboardConfigs();
            if(!Creator.Dashboards){
                // Creator新版本发包前Creator.Dashboards全局变量不存在
                Creator.Dashboards = {}
            }
            _.each(allDashboards, function (dashboard) {
                if (!dashboard._id)
                    dashboard._id = dashboard.name
                Creator.Dashboards[dashboard._id] = dashboard
            });

            let allServerScripts = objectql.getServerScripts();
            _.each(allServerScripts, function (scriptFile) {
                require(scriptFile)
            });

            _.each(allObjects, function (obj) {
                const objectConfig = obj.metadata;
                const localObjectConfig = objectql.getObjectConfig(objectConfig.name);
                if(localObjectConfig){
                    if(Creator.Objects[objectConfig.name]){
                        extend(localObjectConfig, {methods: Creator.Objects[objectConfig.name].methods})
                    }
                }
            });

            let clientCodes = getClientBaseObject();

            let clientScripts = objectql.getClientScripts();
            _.each(clientScripts, function (scriptFile) {

                let code = fs.readFileSync(scriptFile, 'utf8');

				clientCodes = clientCodes + '\r\n;' + code + '\r\n;'

            });
            WebAppInternals.additionalStaticJs["/steedos_dynamic_scripts.js"] = clientCodes

            _.each(allObjects, function (obj) {
                const objectConfig = obj.metadata;
                const localObjectConfig = objectql.getObjectConfig(objectConfig.name);
                extend(objectConfig, {triggers: localObjectConfig._baseTriggers})
                if (objectConfig.name != 'users')
                    Creator.loadObjects(objectConfig, objectConfig.name);
            });

        } catch (error) {
            console.error(error)
        }
    }).promise();

}

const getClientBaseObject = () => {
    let baseObject = JSON.stringify(Creator.baseObject, function (key, val) {
        if (typeof val === 'function') {
            return "$FS$" + val.toString().replace(/\"/g, "'")+"$FE$";
        }
        if(key === 'listeners'){
            return 'null';
        }
        return val;
    });
    let code = "Creator.baseObject=" + baseObject;
    code = code.replace(/"\$FS\$/g, "").replace(/\$FE\$"/g, "").replace(/'\$FS\$/g, "").replace(/\$FE\$'/g, "").replace(/\\r/g, "").replace(/\\n/g, "")
    code = code + ";\r\n";
    return code;
}

export class Core {

    static run() {
        this.initGraphqlAPI();
        this.initPublishAPI()
        this.initCoreRoutes();
        this.initRouters();
    }

    transformTriggerWhen(triggerWhen: string){
        let when = triggerWhen;
        switch (triggerWhen) {
            case 'beforeInsert':
                when = 'before.insert'
                break;
            case 'beforeUpdate':
                when = 'before.update'
                break;
            case 'beforeDelete':
                when = 'before.delete'
                break;
            case 'afterInsert':
                when = 'after.insert'
                break;
            case 'afterUpdate':
                when = 'after.update'
                break;
            case 'afterDelete':
                when = 'after.delete'
                break;
            default:
                break;
        }
        return when
    }

    private static initGraphqlAPI() {
        router.use("/", steedosAuth.setRequestUser);
        router.use("/", function (req, res, next) {
            if (req.user) {
                return next();
            } else {
                return res.status(401).send({
                    errors: [
                        {
                            'message': 'You must be logged in to do this.'
                        }
                    ]
                });
            }
        });

        router.use('/', graphqlHTTP(async (request, response, graphQLParams) => ({
              schema: objectql.getSteedosSchema().getGraphQLSchema(),
              graphiql: true,
            })),
        );

        app.use('/graphql/v1', router);
        return WebApp.connectHandlers.use(app);
    }

    private static initPublishAPI() {
        Publish.init();
    }

    private static initCoreRoutes() {
        // /api/v4/users/login, /api/v4/users/validate
        app.use(steedosAuth.authExpress);
        app.use(bootStrapExpress);
        app.use(steedosProcess.processExpress)
        app.use(coreExpress);

        let routers = objectql.getRouterConfigs()
        _.each(routers, (item)=>{
            app.use(item.prefix, item.router)
        })

        WebApp.connectHandlers.use(app);
    }

    private static initRouters(){
        let routers = objectql.getRouters()
        _.each(routers, (router)=>{
            routersApp.use('', router.default)
        })
        WebApp.connectHandlers.use(routersApp);
    }
}

export const initPublic = () => {
    const router = express.Router()

    let publicPath = require.resolve("@steedos/webapp/package.json")
    publicPath = publicPath.replace("package.json", 'build')
    let routerPath = "/"
    if(__meteor_runtime_config__.ROOT_URL_PATH_PREFIX){
        routerPath = __meteor_runtime_config__.ROOT_URL_PATH_PREFIX
    }
    const cacheTime = 86400000*1; // one day
    router.use(routerPath, express.static(publicPath, { maxAge: cacheTime }));
    WebApp.rawConnectHandlers.use(router);
    // WebApp.connectHandlers.use(router);
}

export const initDesignSystem = () => {
    // const router = express.Router()

    // let dsPath = require.resolve("@salesforce-ux/design-system/package.json")
    // dsPath = dsPath.replace("package.json", 'assets')
    // let routerPath = "/assets/"
    // if (__meteor_runtime_config__ && __meteor_runtime_config__.ROOT_URL_PATH_PREFIX)
    //     routerPath = __meteor_runtime_config__.ROOT_URL_PATH_PREFIX + "/assets/";
    // const cacheTime = 86400000*1; // one day
    // router.use(routerPath, express.static(dsPath, { maxAge: cacheTime }));
    // WebApp.rawConnectHandlers.use(router);
}
