import WebSocketConnector from "../../protocol/WebSocketConnector.js";
import Ajax from "../../protocol/Ajax.js";
import {isDefined, randomUUID} from "../../utils/Utils.js";
import TopicConnector from "../../protocol/TopicConnector.js";
import {EventType} from "../../event/EventType.js";
import {Status} from "../../protocol/Status";
import HttpConnector from "../../protocol/HttpConnector";

class DataSourceHandler {

    constructor(parser, worker) {
        this.parser = parser;
        this.connector = null;
        this.reconnectTimeout = 1000 * 10; // 10 secs
        this.values = [];
        this.version = -Number.MAX_SAFE_INTEGER;
        this.id = randomUUID();
        this.initialized = false;
    }

    init(propertiesStr, topic, dataSourceId) {
        this.dataSourceId = dataSourceId;
        // check for existing protocol
        if(this.connector !== null) {
            this.connector.disconnect();
            this.connector = null;
        }

        this.broadcastChannel = new BroadcastChannel(topic);

        const properties = propertiesStr;

        this.handleProperties(properties);

        this.createDataConnector(this.properties);

        this.initialized = true;
    }

    handleProperties(properties) {
        if (isDefined(properties.bufferingTime)) {
            this.bufferingTime = properties.bufferingTime;
        }

        if (isDefined(properties.timeOut)) {
            this.timeOut = properties.timeOut;
        }

        if (isDefined(properties.reconnectTimeout)) {
            this.reconnectTimeout = properties.reconnectTimeout;
        }

        this.properties = properties;
    }


    /**
     * @protected
     */
    createDataConnector(properties, connector = undefined) {
        this.updatedProperties = properties;
        const url = properties.protocol + '://' + properties.endpointUrl;

        if(!isDefined(connector)) {
            // checks if type is WebSocketConnector
            if (properties.protocol.startsWith('ws')) { // for wss
                this.connector = new WebSocketConnector(url);
            } else if (properties.protocol.startsWith('http')) { //for https
                this.connector = new HttpConnector(url, {
                    responseType: properties.responseType || 'arraybuffer',
                    method: 'GET'
                });
            } else if (properties.protocol === 'topic') {
                this.connector = new TopicConnector(url);
            }
        } else {
            this.connector = connector;
        }
        this.setUpConnector();
    }

    setUpConnector() {
        if (this.connector !== null) {
            // set the reconnectTimeout
            this.connector.setReconnectTimeout(this.reconnectTimeout);

            // connects the callback
            this.connector.onMessage = this.onMessage.bind(this);

            // bind change connection STATUS
            this.connector.onChangeStatus   = this.onChangeStatus.bind(this);
        }
    }
    /**
     * Sets the current topic to listen
     * @param {String} topic - the topic to listen
     */
    setTopic(topic) {
        if(isDefined(this.broadcastChannel)) {
            console.warn('close old topic ',this.topic)
            this.broadcastChannel.close();
        }
        this.broadcastChannel = new BroadcastChannel(topic);
        this.topic = topic;
        console.log('create new topic ',topic)
    }

    connect() {
        if(this.connector !== null) {
            this.connector.doRequest('', this.parser.buildUrl(this.updatedProperties));
        }
    }

    disconnect() {
        if(this.connector !== null) {
            this.connector.disconnect();
        }
    }

    async onMessage(event) {
        const data   = await Promise.resolve(this.parser.parseData(event));

        // check if data is array
        if (Array.isArray(data)) {
            for(let i=0;i < data.length;i++) {
                this.values.push({
                    data: data[i],
                    version: this.version
                });
                if (isDefined(this.batchSize) && this.values.length >= this.batchSize) {
                    this.flush();
                }
            }
        } else {
            this.values.push({
                data: data,
                version: this.version
            });
        }
        // because parseData is ASYNC, the protocol can finish before the parsing method. In that case, we have to flushALl data
        if (!this.isConnected()) {
            this.flushAll();
        } else if (isDefined(this.batchSize) && this.values.length !== 0 && this.values.length >= this.batchSize) {
            this.flush();
        }
    }

    /**
     * Send a change status event into the broadcast channel
     * @param {Status} status - the new status
     */
    onChangeStatus(status) {
        if(status === Status.DISCONNECTED) {
            this.flushAll();
        }

        this.broadcastChannel.postMessage({
            type: EventType.STATUS,
            status: status,
            dataSourceId: this.dataSourceId
        });
    }

    updateProperties(properties) {
        this.disconnect();

        this.createDataConnector({
            ...this.properties,
            ...properties
        });

        this.version++;
        this.connect();
    }

    flushAll() {
        while(this.values.length > 0) {
            this.flush();
        }
    }

    flush() {
        let nbElements = this.values.length;
        if (isDefined(this.batchSize) && this.values.length > this.batchSize) {
            nbElements = this.batchSize;
        }
        // console.log('push message on ',this.broadcastChannel)
        this.broadcastChannel.postMessage({
            dataSourceId: this.dataSourceId,
            type: EventType.DATA,
            values: this.values.splice(0, nbElements)
        });
    }

    isConnected() {
        return (this.connector === null)? false: this.connector.isConnected();
    };

    handleMessage(message, worker) {
        let data = undefined;

        if(message.message === 'init') {
            if(!this.initialized) {
                this.init(message.properties, message.topic, message.id);
            }
            data = this.initialized;
        } else if (message.message === 'connect') {
            this.connect();
        } else if (message.message === 'disconnect') {
            this.disconnect();
        } else if (message.message === 'topic') {
            this.setTopic(message.topic);
        } else if (message.message === 'update-url') {
            this.updateProperties(message.data);
        } else if (message.message === 'is-connected') {
            data = this.isConnected();
        } else if (message.message === 'is-init') {
            data = this.initialized;
        } else {
            // skip response
            return;
        }
        worker.postMessage({
            message: message.message,
            data: data,
            messageId: message.messageId
        })
    }
}
export default DataSourceHandler;

