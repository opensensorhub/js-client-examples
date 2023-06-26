/***************************** BEGIN LICENSE BLOCK ***************************

 The contents of this file are subject to the Mozilla Public License, v. 2.0.
 If a copy of the MPL was not distributed with this file, You can obtain one
 at http://mozilla.org/MPL/2.0/.

 Software distributed under the License is distributed on an "AS IS" basis,
 WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 for the specific language governing rights and limitations under the License.

 Copyright (C) 2015-2022 Georobotix Inc. All Rights Reserved.

 Author: Mathieu Dhainaut <mathieu.dhainaut@gmail.com>

 ******************************* END LICENSE BLOCK ***************************/

import {DATA_SYNCHRONIZER_TOPIC, DATASOURCE_TIME_TOPIC} from "../Constants";
import {assertDefined, isDefined} from "../utils/Utils";
import DataSource from "./DataSource.datasource";
import {Mode} from './Mode';

/**
 * The DataSource is the abstract class used to create different datasources.
 *
 */
class TimeSeriesReplayDatasource extends DataSource {
    constructor(name, properties) {
        super(name, properties);

        this.setMinTime(properties.startTime);
        this.setMaxTime(properties.endTime);
        this.properties.startTimestamp = new Date(properties.startTime).getTime();
        this.properties.endTimestamp = new Date(properties.endTime).getTime();

        assertDefined(properties, 'Some properties must be defined');
        this.dataSynchronizer = undefined;

        this.properties.version = 0;
    }

    getTimeTopicId() {
        return DATASOURCE_TIME_TOPIC + this.id;
    }

    /**
     * Gets the mode
     * @returns {Mode} - Datasource mode
     */
    getMode() {
        return this.properties.mode;
    }

    /**
     * Gets the startTime
     * @returns {String} - startTime as ISO date
     */
    getStartTimeAsIsoDate() {
        return new Date(this.getStartTimeAsTimestamp()).toISOString();
    }

    /**
     * Gets the startTime
     * @returns {String} - startTime as unix timestamp
     */
    getStartTimeAsTimestamp() {
        return this.properties.startTimestamp;
    }

    /**
     * Gets the endTime
     * @returns {String} - endTime as ISO date
     */
    getEndTimeAsIsoDate() {
        return new Date(this.getEndTimeAsTimestamp()).toISOString();
    }

    /**
     * Gets the endTime
     * @returns {String} - endTime as unix timestamp
     */
    getEndTimeAsTimestamp() {
        return this.properties.endTimestamp;
    }

    /**
     * Gets the startTime
     * @returns {String} - startTime as ISO date
     */
    getMinTimeAsIsoDate() {
        return new Date(this.getMinTimeAsTimestamp()).toISOString();
    }

    /**
     * Gets the endTime
     * @returns {String} - endTime as ISO date
     */
    getMaxTimeAsIsoDate() {
        return new Date(this.getMaxTimeAsTimestamp()).toISOString();
    }

    /**
     * Gets the startTime
     * @returns {String} - startTime as unix timestamp
     */
    getMinTimeAsTimestamp() {
        return this.properties.minTimestamp;
    }

    /**
     * Gets the endTime
     * @returns {String} - endTime as unix timestamp
     */
    getMaxTimeAsTimestamp() {
        return this.properties.maxTimestamp;
    }

    /**
     * Sets the min time
     */
    async setMinTime(time) {
        this.properties.minTimestamp = new Date(time).getTime();
        await this.computeMinMax();
    }

    /**
     * Sets the max time
     */
    async setMaxTime(time) {
        this.properties.maxTimestamp = new Date(time).getTime();
        await this.computeMinMax();
    }

    /**
     * Sets the start time
     */
    async setStartTimestamp(timestamp) {
        this.properties.startTimestamp = timestamp;
        await this.computeMinMax();
    }

    /**
     * Sets the end time
     */
    async setEndTimestamp(timestamp) {
        this.properties.endTimestamp = timestamp;
        this.computeMinMax();
    }

    /**
     * Sets the start time
     */
    async setStartTime(time) {
        await this.setStartTimestamp(new Date(time).getTime());
    }

    /**
     * Sets the end time
     */
    async setEndTime(time) {
        await this.setEndTimestamp(new Date(time).getTime());
    }

    /**
     * Gets the endTime
     * @returns {String} - endTime as ISO date
     */
    getReplaySpeed() {
        return this.properties.replaySpeed;
    }

    /**
     * Gets the endTime
     * @returns {String} - endTime as ISO date
     */
    setReplaySpeed(replaySpeed) {
        this.properties.replaySpeed = replaySpeed;
    }

    setVersion(version) {
        this.properties.version = version;
    }

    //----------- ASYNCHRONOUS FUNCTIONS -----------------//

    /**
     * @param dataSynchronizer
     * @returns {Promise}
     */
    async setDataSynchronizer(dataSynchronizer) {
        await this.checkInit();
        const topic = DATA_SYNCHRONIZER_TOPIC + dataSynchronizer.getId();
        this.dataSynchronizer = dataSynchronizer;
        this.properties.version = this.dataSynchronizer.version();
        return this.dataSourceWorker.postMessageWithAck({
            message: 'topics',
            topics: {
                data: topic,
                time: this.getTimeTopicId(),
                sync: dataSynchronizer.getTimeTopicId()
            },
        });
    }

    async removeDataSynchronizer() {
        if (this.dataSourceWorker) {
            this.dataSourceWorker.terminate();
            this.dataSynchronizer = undefined;
        }
        this.init = undefined;
        this.dataSynchronizer = undefined;
        await this.checkInit();

    }

    /**
     * Disconnect the dataSource then the protocol will be closed as well.
     */
    async disconnect() {
        if (isDefined(this.init)) {
            try {
                return this.dataSourceWorker.postMessageWithAck({
                    message: 'disconnect'
                });
            } catch (ex) {
                console.error(ex);
            }
        }
    }

    async doConnect() {
        return this.dataSourceWorker.postMessageWithAck({
            message: 'connect',
            startTime: this.getStartTimeAsIsoDate(),
            version: this.version()
        });
    }

    /**
     * Inits the datasource with the constructor properties.
     * @protected
     * @param properties
     */
    async initDataSource(properties) {
        await super.initDataSource(properties);
        const topics = {
            data: this.getTopicId(),
            time: this.getTimeTopicId()
        };
        if (this.dataSynchronizer) {
            topics.sync = dataSynchronizer.getTimeTopicId()
        }

        return this.dataSourceWorker.postMessageWithAck({
            message: 'topics',
            topics: topics,
        }).then(() => {
            // listen for Events to callback to subscriptions
            const datasourceBroadcastChannel = new BroadcastChannel(this.getTimeTopicId());
            datasourceBroadcastChannel.onmessage = async (message) => {
                await this.handleTimeMessage(message);
            };
        });
    }

    async handleTimeMessage(message) {
        const type = message.data.type;
        if (type in this.eventSubscriptionMap) {
            for (let i = 0; i < this.eventSubscriptionMap[type].length; i++) {
                this.eventSubscriptionMap[type][i](message.data);
            }
        }
    }

    version() {
        return this.properties.version;
    }

    computeMinMax() {
        // intersect end/start depending on the min/max
        if (this.properties.startTimestamp < this.properties.minTimestamp) {
            this.properties.startTimestamp = this.properties.minTimestamp;
        }
        if (this.properties.endTimestamp > this.properties.maxTimestamp) {
            this.properties.endTimestamp = this.properties.maxTimestamp;
        }
    }

    /**
     * Sets the data source time range
     * @param {String} startTime - the startTime (in date ISO)
     * @param {String} endTime - the startTime (in date ISO)
     * @param {Number} replaySpeed - the replay speed
     * @param {boolean} reconnect - reconnect if was connected
     * @param {Mode} mode - default dataSource mode
     * @param {Number} version - version of data
     */
    async setTimeRange(startTime = this.getStartTimeAsIsoDate(),
                       endTime = this.getEndTimeAsIsoDate(),
                       replaySpeed = this.getReplaySpeed(),
                       reconnect = false,
                       mode = this.getMode(),
                       version = this.version()
    ) {

        await this.checkInit();

        if (version !== this.version()) {
            // update version if come in from other input
            this.properties.version = version;
        }

        // compute intersection
        this.properties.startTimestamp = new Date(startTime).getTime();
        this.properties.endTimestamp = new Date(endTime).getTime();

        this.computeMinMax();

        return this.updateProperties({
            startTime: this.getStartTimeAsIsoDate(),
            endTime: this.getEndTimeAsIsoDate(),
            replaySpeed: replaySpeed,
            reconnect: reconnect,
            mode: mode,
            version: version
        });
    }
}

export default TimeSeriesReplayDatasource;
