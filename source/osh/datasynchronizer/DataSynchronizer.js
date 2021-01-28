/***************************** BEGIN LICENSE BLOCK ***************************

 The contents of this file are subject to the Mozilla Public License, v. 2.0.
 If a copy of the MPL was not distributed with this file, You can obtain one
 at http://mozilla.org/MPL/2.0/.

 Software distributed under the License is distributed on an "AS IS" basis,
 WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 for the specific language governing rights and limitations under the License.

 Copyright (C) 2015-2020 Mathieu Dhainaut. All Rights Reserved.

 Author: Mathieu Dhainaut <mathieu.dhainaut@gmail.com>

 ******************************* END LICENSE BLOCK ***************************/

import {isDefined, randomUUID} from "../utils/Utils.js";
import DataSynchronizerWorker from './DataSynchronizer.worker.js';
import {DATA_SYNCHRONIZER_TOPIC, DATASOURCE_DATA_TOPIC, TIME_SYNCHRONIZER_TOPIC} from "../Constants.js";

class DataSynchronizer {
    /**
     * Creates The dataSynchronizer.
     * @param {Object} properties - the property of the object
     * @param {Number} [properties.replaySpeed=1] - replaySpeed value
     * @param {Number} [properties.intervalRate=5] - interval in which data is played (in milliseconds)
     * @param {DataSource[]} properties.dataSources - the dataSource array
     */
    constructor(properties) {
        if(!isDefined(properties.dataSources)) {
            throw 'You must specify a dataSource array';
        }
        this.bufferingTime = 1000; // default
        this.currentTime = Date.now();
        this.id = randomUUID();
        this.dataSources = [];
        this.replaySpeed = 1;
        this.intervalRate = 5;

        if(isDefined(properties.replaySpeed)) {
            this.replaySpeed = properties.replaySpeed;
        }
        if(isDefined(properties.intervalRate)) {
            this.intervalRate = properties.intervalRate;
        }
        this.initWorker(properties.dataSources, this.intervalRate);
    }

    /**
     * @private
     */
    initWorker(dataSources, intervalRate) {
        // build object for Worker because DataSource is not clonable
        const dataSourcesForWorker = [];
        for(let dataSource of dataSources) {
            const dataSourceForWorker= this.createDataSourceForWorker(dataSource);
            dataSourcesForWorker.push(dataSourceForWorker);
            this.dataSources.push(dataSource);
        }

        this.synchronizerWorker = new DataSynchronizerWorker();
        this.synchronizerWorker.postMessage({
            message: 'init',
            dataSources: dataSourcesForWorker,
            replaySpeed: this.replaySpeed,
            intervalRate: intervalRate,
            dataTopic: this.getTopicId(),
            timeTopic: this.getTimeTopicId(),
        });
    }

    /**
     * @private
     * @param dataSource
     */
    createDataSourceForWorker(dataSource) {
        const obj = {
            bufferingTime: dataSource.bufferingTime || 0,
            timeOut: dataSource.timeOut || 0,
            id: dataSource.id
        };
        // bind dataSource data onto dataSynchronizer data
        try {
            dataSource.setDataSynchronizer(this);
            dataSource.properties.replaySpeed = this.replaySpeed;
        } catch(ex) {
            console.error("Cannot set the synchronizer to this DataSource", ex);
        }
        return obj;
    }

    addDataSource(dataSource) {
        const dataSourceForWorker = this.createDataSourceForWorker(dataSource);
        this.dataSources.push(dataSource);
        this.synchronizerWorker.postMessage({
            message: 'add',
            dataSources: [dataSourceForWorker]
        });
    }

    /**
     * @param {String} dataSourceId - the dataSource id
     * @param {Object} data - the data to push into the data synchronizer
     */
    push(dataSourceId, data) {
        if(this.synchronizerWorker !== null) {
            this.synchronizerWorker.postMessage({
                type: 'data',
                dataSourceId: dataSourceId,
                data: data
            });
        }
    }

    /**
     * Connects all dataSources
     */
    connect() {
        for(let dataSource of this.dataSources) {
            dataSource.connect();
        }
    }

    /**
     * Disconnects all dataSources
     */
    disconnect() {
        this.reset();
        for(let dataSource of this.dataSources) {
            dataSource.disconnect();
        }
    }

    /**
     * Gets the startTime of the first DataSource objet
     * @returns {String} - startTime as ISO date
     */
    getStartTime() {
        if(this.dataSources.length === 0) {
            throw 'dataSource array is empty';
        }
        return this.dataSources[0].properties.startTime;
    }

    /**
     * Gets the endTime of the first DataSource objet
     * @returns {String} - endTime as ISO date
     */
    getEndTime() {
        if(this.dataSources.length === 0) {
            throw 'dataSource array is empty';
        }
        return this.dataSources[0].properties.endTime;
    }

    /**
     * Gets the replaySpeed
     * @returns {Number} - the replay speed
     */
    getReplaySpeed() {
        return this.replaySpeed;
    }
    /**
     * Sets the data source time range
     * @param {String} startTime - the startTime (in date ISO)
     * @param {String} endTime - the startTime (in date ISO)
     * @param {Number} replaySpeed - the replay speed
     */
    setTimeRange(startTime, endTime, replaySpeed) {
        this.reset();
        for(let ds of this.dataSources) {
            ds.setTimeRange(startTime, endTime, replaySpeed);
        }
    }

    /**
     * Resets reference time
     */
    reset() {
        if(this.synchronizerWorker !== null) {
            this.synchronizerWorker.postMessage({
                message: 'reset'
            });
        }
    }
    /**
     * Terminate the corresponding running WebWorker by calling terminate() on it.
     */
    terminate() {
        if(this.synchronizerWorker !== null) {
            this.synchronizerWorker.terminate();
            this.synchronizerWorker = null;
        }
        for(let dataSource of this.dataSources) {
            dataSource.terminate();
        }
    }

    async getCurrentTime() {
        const promise = new Promise(resolve => {
            if(this.synchronizerWorker !== null) {
                this.synchronizerWorker.onmessage = (event) => {
                    if (event.data.message === 'current-time') {
                        resolve(event.data.data);
                    }
                };
            }
        });
        if(this.synchronizerWorker !== null) {
            this.synchronizerWorker.postMessage({
                message: 'current-time'
            });
        }

        return promise;
    }

    getTopicId() {
        return DATA_SYNCHRONIZER_TOPIC+this.id;
    }

    getTimeTopicId() {
        return TIME_SYNCHRONIZER_TOPIC+this.id;
    }
}
export default  DataSynchronizer;
