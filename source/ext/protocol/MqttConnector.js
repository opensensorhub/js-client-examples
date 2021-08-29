/***************************** BEGIN LICENSE BLOCK ***************************

 The contents of this file are subject to the Mozilla Public License, v. 2.0.
 If a copy of the MPL was not distributed with this file, You can obtain one
 at http://mozilla.org/MPL/2.0/.

 Software distributed under the License is distributed on an "AS IS" basis,
 WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 for the specific language governing rights and limitations under the License.

 Copyright (C) 2021 Georobotix Inc. All Rights Reserved.

 Author: Mathieu Dhainaut <mathieu.dhainaut@gmail.com>

 ******************************* END LICENSE BLOCK ***************************/

import DataConnector from "../../core/protocol/DataConnector";
import mqtt from 'mqtt';
import {assertDefined, isDefined} from "../../core/utils/Utils";
import {Status} from "../../core/protocol/Status";

/**
 * Defines the MqttConnector to connect to a remote server by creating a Mqtt channel.
 * @extends DataConnector
 * @example
 * import MqttConnector from 'osh-js/dataconnector/MqttConnector.js';
 *
 * let url = ...;
 * let connector = new MqttConnector(url);
 *
 * // connect
 * connector.connect();
 *
 * // disconnect
 * connector.disconnect();
 *
 * // close
 * connector.close();
 *
 */

class MqttConnector extends DataConnector {
    /**
     *
     * @param properties -
     */
    constructor(url, properties, dataSource) {
        super(url, properties);
        this.interval = -1;
        this.dataSource = dataSource;
    }

    /**
     * Connect to the Mqtt broker.
     */
    async connect() {
        if (!this.init) {
            this.init = true;
            const url = this.getUrl();
            let options = {
                reconnectPeriod: this.reconnectTimeout,
                connectTimeout: 30 * 1000
            };

            if(isDefined(this.properties.options)) {
                options = {
                    ...options,
                    ...this.properties.options
                }
            }
            const client = mqtt.connect(url, {...options});

            assertDefined(this.properties.topic, 'topic');
            const that = this;
            client.on('connect', function () {
                that.checkStatus(Status.CONNECTED);
                console.warn(`Connected to ${url}`);
                client.subscribe(that.properties.topic, function (err) {
                    if (err) {
                        console.error(err);
                        that.checkStatus(Status.DISCONNECTED);
                    } else {
                        console.warn(`Subscribed to ${that.properties.topic}`);
                    }
                });
            });
            client.on('message', function (topic, message) {
                // message is Buffer
                this.dataSource.onMessage(message);
            }.bind(that));

            this.client = client;
        }
    }

    unsubscribe(topic) {
        if(this.isConnected()) {
            this.client.unsubscribe(topic);
        }
    }

    /**
     * Disconnects and close the mqtt client.
     */
    disconnect() {
        // does not call super to avoid reconnection logic and use the one of the mqtt.js lib
        this.checkStatus(Status.DISCONNECTED);
        this.init = false;
        this.closed = true;
        if(isDefined(this.client) && this.client !== null) {
            // close the client right away, without waiting for the in-flight messages to be acked
            this.client.end(true);
            this.client = null;
        }
        console.warn(`Disconnected from ${this.getUrl()}`);
    }

    /**
     * The onMessage method used by the mqtt client to callback the data
     * @param data the callback data
     * @event
     */
    onMessage(data) {
    }

    isConnected() {
        if(!isDefined(this.client) && this.client == null) {
            return false;
        } else {
            return this.client.connected;
        }
    }
}

export default MqttConnector;
