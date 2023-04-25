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

import {assertDefined, isDefined, randomUUID} from "../utils/Utils.js";
import DataSynchronizerWorker from './DataSynchronizer.worker.js';
import {DATA_SYNCHRONIZER_TOPIC, TIME_SYNCHRONIZER_TOPIC} from "../Constants.js";
import {Mode} from "../datasource/Mode";

class DataSynchronizer {
    /**
     * Creates The dataSynchronizer.
     * @param {Object} properties - the property of the object
     * @param {String} [properties.id=randomUUID] - id of the dataSynchronizer or random if not provided
     * @param {Number} [properties.replaySpeed=1] - replaySpeed value
     * @param {Number} [properties.timerResolution=5] - interval in which data is played (in milliseconds)
     * @param {Number} [properties.masterTimeRefreshRate=250] - interval in which time value is send through broadcast channel (in milliseconds)
     * @param {Number} [properties.mode=Mode.REPLAY] - mode of the data synchronizer
     * @param {String} properties.startTime - start time of the temporal run
     * @param {String} properties.endTime - end time of the temporal run
     * @param {Datasource[]} properties.dataSources - the dataSource array
     */
    constructor(properties) {
        this.bufferingTime = 1000; // default
        this.currentTime = Date.now();
        this.id = properties.id || randomUUID();
        this.dataSources = properties.dataSources || [];
        this.replaySpeed = properties.replaySpeed || 1;
        this.timerResolution = properties.timerResolution || 5;
        this.masterTimeRefreshRate = properties.masterTimeRefreshRate || 250;
        this.mode = properties.mode || Mode.REPLAY;
        this.initialized = false;
        this.properties = {};
        this.properties.replaySpeed = this.replaySpeed;

        this.eventSubscriptionMap = {};
        this.messagesMap = {};

        this.last = {
            startTime: undefined,
            endTime: undefined,
            replaySpeed: 1.0
        };

        if(this.mode !== Mode.REAL_TIME) {
            assertDefined(properties.startTime, 'startTime');
            assertDefined(properties.startTime, 'endTime');
            this.properties.startTime = properties.startTime;
            this.properties.endTime = properties.endTime;
        } else {
            this.properties.startTime = 'now';
            this.properties.endTime = '2055-01-01Z';
        }
    }

    getTopicId() {
        return DATA_SYNCHRONIZER_TOPIC+this.id;
    }

    getTimeTopicId() {
        return TIME_SYNCHRONIZER_TOPIC+this.id;
    }

    /**
     * @private
     */
    initEventSubscription() {
        // listen for Events to callback to subscriptions
        new BroadcastChannel(this.getTopicId()).onmessage = (message) => {
            const type = message.data.type;
            if(type in this.eventSubscriptionMap){
                for(let i=0;i < this.eventSubscriptionMap[type].length;i++) {
                    this.eventSubscriptionMap[type][i](message.data);
                }
            }
        };

        new BroadcastChannel(this.getTimeTopicId()).onmessage = (message) => {
            const type = message.data.type;
            if(type in this.eventSubscriptionMap){
                for(let i=0;i < this.eventSubscriptionMap[type].length;i++) {
                    this.eventSubscriptionMap[type][i](message.data);
                }
            }
        };
    }

    /**
     * Gets the startTime of the first DataSource objet
     * @returns {String} - startTime as ISO date
     */
    getStartTime() {
        if(this.dataSources.length === 0) {
            throw 'dataSource array is empty';
        }
        let min = Number.MAX_VALUE;
        for(let ds of this.dataSources) {
            let currentDsMinTimestamp = new Date(ds.getStartTime()).getTime();
            if(currentDsMinTimestamp < min) {
                min = currentDsMinTimestamp;
            }
        }
        return new Date(min).toISOString();
    }

    /**
     * Gets the endTime of the first DataSource objet
     * @returns {String} - endTime as ISO date
     */
    getEndTime() {
        if(this.dataSources.length === 0) {
            throw 'dataSource array is empty';
        }
        let max = Number.MIN_VALUE;
        for(let ds of this.dataSources) {
            let currentDsMaxTimestamp = new Date(ds.getEndTime()).getTime();
            if(currentDsMaxTimestamp > max) {
                max = currentDsMaxTimestamp;
            }
        }
        return new Date(max).toISOString();
    }

    /**
     * Gets the minTime of the first DataSource objet
     * @returns {String} - minTime as ISO date
     */
    getMinTime() {
        if(this.dataSources.length === 0) {
            throw 'dataSource array is empty';
        }
        let min = Number.MAX_VALUE;
        for(let ds of this.dataSources) {
            let currentDsMinTimestamp = new Date(ds.getMinTime()).getTime();
            if(currentDsMinTimestamp < min) {
                min = currentDsMinTimestamp;
            }
        }
        return new Date(min).toISOString();
    }

    /**
     * Gets the maxTime of the first DataSource objet
     * @returns {String} - endTime as ISO date
     */
    getMaxTime() {
        if(this.dataSources.length === 0) {
            throw 'dataSource array is empty';
        }
        let max = Number.MIN_VALUE;
        for(let ds of this.dataSources) {
            let currentDsMaxTimestamp = new Date(ds.getMaxTime()).getTime();
            if(currentDsMaxTimestamp > max) {
                max = currentDsMaxTimestamp;
            }
        }
        return new Date(max).toISOString();
    }

    setMinTime(time) {
        for(let ds of this.dataSources) {
            ds.setMinTime(time);
        }
    }

    setMaxTime(time) {
        for(let ds of this.dataSources) {
            ds.setMaxTime(time);
        }
    }

    /**
     * Gets the replaySpeed
     * @returns {Number} - the replay speed
     */
    getReplaySpeed() {
        return this.replaySpeed;
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
        this.lastTime = {
            start: undefined,
            end: undefined
        }
    }

    subscribe(fn, eventTypes) {
        // associate function to eventType
        for(let i=0;i < eventTypes.length;i++) {
            if (!(eventTypes[i] in this.eventSubscriptionMap)) {
                this.eventSubscriptionMap[eventTypes[i]] = [];
            }
            this.eventSubscriptionMap[eventTypes[i]].push(fn);
        }
    }

    getMode() {
        return this.mode;
    }
    //----------- ASYNCHRONOUS FUNCTIONS -----------------//

    async initDataSources() {
        return new Promise(async (resolve, reject) => {
            try {
                const dataSourcesForWorker = [];
                let mode = this.mode;
                for (let dataSource of this.dataSources) {
                    const dataSourceForWorker = await this.createDataSourceForWorker(dataSource);
                    dataSourcesForWorker.push(dataSourceForWorker);
                    mode = dataSource.mode;
                }
                this.synchronizerWorker = new DataSynchronizerWorker();
                this.handleWorkerMessage();
                await this.postMessage({
                    message: 'init',
                    dataSources: dataSourcesForWorker,
                    replaySpeed: this.replaySpeed,
                    timerResolution: this.timerResolution,
                    masterTimeRefreshRate: this.masterTimeRefreshRate,
                    startTime: this.properties.startTime,
                    endTime: this.properties.endTime,
                    mode: mode,
                    topics:  {
                        data: this.getTopicId(),
                        time: this.getTimeTopicId()
                    }
                }, function (){
                    this.initEventSubscription();
                    this.initialized = true;
                    resolve();
                }.bind(this), false);
            } catch (error) {
                console.log(error)
                reject(error);
            }
        });
    }

    /**
     * @private
     * @param dataSource
     */
    async createDataSourceForWorker(dataSource) {
        const obj = {
            bufferingTime: dataSource.properties.bufferingTime || 0,
            timeOut: dataSource.properties.timeOut || 0,
            id: dataSource.id,
            name: dataSource.name,
            minTimestamp: new Date(dataSource.getMinTime()).getTime(),
            maxTimestamp: new Date(dataSource.getMaxTime()).getTime(),
        };
        // bind dataSource data onto dataSynchronizer data
        try {
            await dataSource.setDataSynchronizer(this);
            dataSource.properties.replaySpeed = this.replaySpeed;
        } catch (ex) {
            console.error("Cannot set the synchronizer to this DataSource", ex);
            throw ex;
        }
        return obj;
    }

    /**
     * Adds a new DataSource object to the list of datasources to synchronize.
     * note: don't forget to call reset() to be sure to re-init the synchronizer internal properties.
     * @param {Datasource} dataSource - the new datasource to add
     */
    async addDataSource(dataSource) {
        return new Promise(async resolve => {
            if (!this.initialized) {
                console.log(`DataSynchronizer not initialized yet, add DataSource ${dataSource.id} as it`);
                this.dataSources.push(dataSource);
                this.onTimeChanged(this.getMinTime(), this.getMaxTime());
            } else {
                const dataSourceForWorker = await this.createDataSourceForWorker(dataSource);
                const lastTimestamp = (await this.getCurrentTime()).data;
                if (isDefined(lastTimestamp)) {
                    const minDsTimestamp = new Date(dataSource.getMinTime()).getTime();
                    const maxDsTimestamp = new Date(dataSource.getMaxTime()).getTime();
                    const current = lastTimestamp + 1000;
                    if(current > minDsTimestamp && current < maxDsTimestamp) {
                        await dataSource.setTimeRange(
                            new Date(lastTimestamp + 1000).toISOString(),
                        );
                    }
                }
                this.dataSources.push(dataSource);
                await this.postMessage({
                    message: 'add',
                    dataSources: [dataSourceForWorker]
                }, async () => {
                    if (this.dataSources.length === 1) {
                        await this.postMessage({
                            message: 'update-properties',
                            mode: this.mode,
                            replaySpeed: this.replaySpeed,
                            startTime: this.getMinTime(),
                            endTime: this.getMaxTime()
                        }, () => {
                            this.onTimeChanged(this.getMinTime(), this.getMaxTime());
                            this.onAddedDataSource(dataSource.id);
                            resolve();
                        });
                    } else {
                        this.onTimeChanged(this.getMinTime(), this.getMaxTime());
                        this.onAddedDataSource(dataSource.id);
                        resolve();
                    }
                });
            }
        });
    }

    /**
     * Removes a DataSource object from the list of datasources of the synchronizer.
     * @param {DataSource} dataSource - the new datasource to add
     */
    async removeDataSource(dataSource) {
        if(!this.initialized) {
            this.dataSources = this.dataSources.filter( elt => elt.id !== dataSource.getId());
            this.onTimeChanged(this.getMinTime(),this.getMaxTime());
        } else {
            return new Promise(async (resolve, reject) => {
                try {
                    this.dataSources = this.dataSources.filter(elt => elt.id !== dataSource.getId());
                    await this.postMessage({
                        message: 'remove',
                        dataSourceIds: [dataSource.getId()]
                    });
                    await dataSource.disconnect();
                    if(this.dataSources.length > 0) {
                        this.onTimeChanged(this.getMinTime(), this.getMaxTime());
                    } else {
                        await this.reset();
                    }
                    this.onRemovedDataSource(dataSource.id);
                    resolve();
                }catch (ex) {
                 reject(ex);
                }
            });
        }
    }

    /**
     * @param {String} dataSourceId - the dataSource id
     * @param {Object} data - the data to push into the data synchronizer
     */
    async push(dataSourceId, data) {
        return new Promise(async (resolve, reject) => {
            if (this.synchronizerWorker !== null) {
                await this.postMessage({
                    type: 'data',
                    dataSourceId: dataSourceId,
                    data: data
                }, resolve);
            }
        });
    }

    /**
     * Connects all dataSources
     */
    async connect() {
        if((this.mode === Mode.REPLAY && this.dataSources.length === 0)) {
            return;
        } else {
            await this.checkInit();
            await this.doConnect();
        }
    }

    async checkInit() {
        const that = this;
        return new Promise(async (resolve, reject) => {
            if(!isDefined(that.init)) {
                that.init = that.initDataSources();
            }
            await that.init;
            resolve();
        });
    }

    async doConnect() {
        return new Promise(async resolve => {
            if(this.last.startTime) {
                await this.setTimeRange(
                    this.last.startTime,
                    this.last.endTime,
                    this.last.replaySpeed,
                    true
                );
            } else {
                for (let dataSource of this.dataSources) {
                    await dataSource.connect();
                }
                await this.postMessage({
                    message: 'connect',
                }, resolve);
            }
        });
    }

    /**
     * Disconnects all dataSources
     */
    async disconnect() {
        // save current time as startTime for later reuse
        const lastTime = (await this.getCurrentTime()).data;
        if(lastTime) {
            this.last.startTime = new Date(lastTime).toISOString();
            console.log(`Saving lastTimestamp as ${this.last.startTime}`);
        }
        await this.reset();
        for (let dataSource of this.dataSources) {
            await dataSource.disconnect();
        }
    }

    /**
     * Sets the replaySpeed
     */
    async setReplaySpeed(replaySpeed) {
        return new Promise(async resolve => {
            this.replaySpeed = replaySpeed;
            this.last.replaySpeed = replaySpeed;
            this.properties.replaySpeed = replaySpeed;
            await this.postMessage({
                message: 'replay-speed',
                replaySpeed: replaySpeed,
            }, resolve);
        });
    }

    /**
     * Sets the data source time range
     * @param {String} startTime - the startTime (in date ISO)
     * @param {String} endTime - the startTime (in date ISO)
     * @param {Number} replaySpeed - the replay speed
     * @param {boolean} reconnect - reconnect if was connected
     * @param {Mode} mode - default dataSource mode
     */
    async setTimeRange(startTime= this.getStartTime(),
                       endTime= this.getEndTime(),
                       replaySpeed= this.getReplaySpeed(),
                       reconnect= false,
                       mode= this.mode) {
        return new Promise(async resolve => {

            // save for later
            this.last.startTime = startTime;
            this.last.endTime = endTime;
            this.last.replaySpeed = replaySpeed;

            this.properties.startTime = startTime;
            this.properties.endTime = endTime;

            await this.postMessage({
                message: 'update-properties',
                mode: mode,
                replaySpeed: replaySpeed,
                startTime: startTime,
                endTime: endTime
            }, () => {
                if(this.dataSources.length > 0 ) {
                    for (let ds of this.dataSources) {
                        ds.setTimeRange(startTime, endTime, replaySpeed, reconnect, mode);
                    }
                    this.onTimeChanged(this.getMinTime(),this.getMaxTime());
                }
                this.mode = mode;
                resolve();
            });
        });
    }

    async updateProperties(properties) {
        for (let ds of this.dataSources) {
            ds.updateProperties(properties);
        }
    }

    resetTimes() {
        this.lastTime = {
            start: undefined,
            end: undefined
        };
        this.startTime = 0;
        this.minTime = 0;
        this.maxTime = 0;
        this.endTime = 0;
        this.lastTime = 0;
    }
    /**
     * Resets reference time
     */
    async reset() {
        return new Promise(async resolve => {
            await this.checkInit();
            await this.postMessage({
                message: 'reset'
            });
            this.resetTimes();
            resolve();
        });
    }

    async getCurrentTime() {
        return new Promise(async resolve => {
            await this.postMessage({
                message: 'current-time'
            }, resolve);
        });
    }

    getLast() {
        return (this.last.startTime)? this.last : { startTime: this.getStartTime(), endTime: this.getEndTime(), replaySpeed: this.getReplaySpeed()};
    }
    /**
     * Connect the dataSource then the protocol will be opened as well.
     */
    async isConnected() {
        if(this.dataSources.length === 0)  {
            return false;
        } else {
            await this.checkInit();
            return new Promise(async resolve => {
                await this.postMessage({
                    message: 'is-connected'
                }, (message) => resolve(message.data));
            });
        }
    }

    async postMessage(props, Fn, checkInit = true) {
        if(checkInit) {
            await this.checkInit();
        }
        const messageId = randomUUID();
        this.synchronizerWorker.postMessage({
            ...props,
            messageId: messageId
        });
        if(isDefined(Fn)) {
            this.messagesMap[messageId] = Fn;
        }
    }

    handleWorkerMessage() {
        this.synchronizerWorker.onmessage = (event) => {
            const id = event.data.messageId;
            if(id in this.messagesMap){
                this.messagesMap[id](event.data.data);
                delete this.messagesMap[id];
            }
        }
    }
    onTimeChanged(start, min){}

    onRemovedDataSource(dataSourceId){}

    onAddedDataSource(dataSourceId){}
}
export default  DataSynchronizer;
