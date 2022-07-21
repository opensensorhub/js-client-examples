import {isDefined} from "../utils/Utils.js";
import {Status} from "../connector/Status.js";

class DataSynchronizerAlgo {
    constructor(dataSources, replaySpeed = 1, timerResolution = 5) {
        this.dataSourceMap = {};
        this.bufferingTime = 1000;
        this.startBufferingTime = -1;
        this.tsRun = 0;
        this.replaySpeed = replaySpeed;
        this.timerResolution = timerResolution;
        let maxBufferingTime = -1;

        for (let ds of dataSources) {
            this.addDataSource(ds);
            maxBufferingTime = ds.bufferingTime > maxBufferingTime ? ds.bufferingTime : maxBufferingTime;
        }
        if (maxBufferingTime !== -1) {
            this.bufferingTime = maxBufferingTime;
        }
    }

    push(dataSourceId, dataBlock) {
        const ds = this.dataSourceMap[dataSourceId];
        if (!this.checkVersion(ds, dataBlock)) {
            return;
        }

        if (this.startBufferingTime === -1) {
            console.log(`synchronizer buffering data for ${this.bufferingTime}ms..`);
            this.startBufferingTime = performance.now();
            // start iterating on dataBlock after bufferingTime
            this.timeoutBuffering = setTimeout(() => this.processData(), this.bufferingTime);
        }

        let latency = 0;
        if (this.tsRun > 0) {
            latency = this.tsRun - dataBlock.data.timestamp;
        }
        ds.latency = latency > ds.latency ? latency : (ds.latency + latency) / 2;

        ds.dataBuffer.push(dataBlock);
    }

    reset() {
        console.log('reset synchronizer algo')
        this.close();
        for (let currentDsId in this.dataSourceMap) {
            const currentDs = this.dataSourceMap[currentDsId];
            currentDs.dataBuffer = [];
            currentDs.startBufferingTime = -1;
            currentDs.latency=0;
            currentDs.status= Status.DISCONNECTED;
            currentDs.version = undefined;
        }
        this.tsRun = 0;
        this.startBufferingTime = -1;
    }

    processData() {
        // the timeout has been cancelled
        if(!isDefined(this.timeoutBuffering)) {
            return;
        }
        let tsRef = -1;
        let clockTimeRef = performance.now();

        // get reference start timestamp
        // the reference start timestamp should the oldest one
        let currentDs;
        for (let currentDsId in this.dataSourceMap) {
            currentDs = this.dataSourceMap[currentDsId];
            if (currentDs.dataBuffer.length > 0) {
                tsRef = (tsRef === -1 || currentDs.dataBuffer[0].data.timestamp < tsRef) ? currentDs.dataBuffer[0].data.timestamp :
                    tsRef;
            }
        }

        this.interval = setInterval(() => {
            // 1) return the oldest data if any
            while (this.computeNextData(tsRef, clockTimeRef)) ;

        }, this.timerResolution);
    }

    /**
     * Compute the next data if any. We return only 1 value for this iteration. If there are multiple values to return,
     * we return only the oldest one.
     * @param tsRef - the timestamp of the first data
     * @param refClockTime - the absolute diff time really spent
     */
    computeNextData(tsRef, refClockTime) {
        let currentDs;
        let currentDsToShift = null;

        // compute max latency
        let maxLatency = 0;
        let minLatency = 0;
        for (let currentDsId in this.dataSourceMap) {
            currentDs = this.dataSourceMap[currentDsId];
            if (currentDs.latency > 0) {
                let latency = Math.min(currentDs.latency, currentDs.timeOut);
                maxLatency = (latency > maxLatency) ? latency : maxLatency;
                minLatency = (currentDs.latency < minLatency) ? currentDs.latency : minLatency;
            }
        }
        maxLatency *= this.replaySpeed;
        minLatency *= this.replaySpeed;

        const dClock = (performance.now() - refClockTime) * this.replaySpeed;
        this.tsRun = tsRef + dClock;

        // compute next data to return
        for (let currentDsId in this.dataSourceMap) {
            currentDs = this.dataSourceMap[currentDsId];
            if (currentDs.dataBuffer.length > 0) {
                const dTs = (currentDs.dataBuffer[0].data.timestamp - tsRef);
                const dClockAdj = dClock - maxLatency;
                // we use an intermediate object to store the data to shift because we want to return the oldest one
                // only
                if (dTs <= dClockAdj) {
                    // no other one to compare
                    if (currentDsToShift === null) {
                        currentDsToShift = currentDs;
                    } else {
                        // take the oldest data
                        currentDsToShift = (currentDsToShift.dataBuffer[0].data.timestamp < currentDs.dataBuffer[0].data.timestamp) ?
                            currentDsToShift : currentDs;
                    }
                }
            }
        }

        // finally pop the data from DS queue
        if (currentDsToShift !== null) {
            let rec = currentDsToShift.dataBuffer.shift();

            // add latency flag to data record before we dispatch it
            // this is relative latency in millis compared to the DS with the lowest latency
            // so it is accurate even if local device time is not set properly
            rec['@latency'] = currentDs.latency - minLatency;

            this.onData(currentDsToShift.id, rec);
            return true;
        }
        return false;
    }

    /**
     * Add dataSource to be synchronized
     * @param {DataSource} dataSource - the dataSource to synchronize
     */
    addDataSource(dataSource) {
        this.dataSourceMap[dataSource.id] = {
            bufferingTime: dataSource.bufferingTime,
            timeOut: dataSource.timeOut || 0,
            dataBuffer: [],
            startBufferingTime: -1,
            id: dataSource.id,
            timedOut: false,
            name: dataSource.name || dataSource.id,
            latency: 0,
            status: Status.DISCONNECTED, //MEANING Enabled, 0 = Disabled
            version: undefined
        };
    }

    checkVersion(datasource, dataBlock) {
        if(!isDefined(datasource.version) && datasource.status !== Status.DISCONNECTED) {
            return true;
        } else if(datasource.status === Status.DISCONNECTED && datasource.version !== dataBlock.version) {
            return false;
        }
    }

    onData(dataSourceId, dataBlock) {
    }

    /**
     * Change the dataSource status
     * @param {Status} status - the new status
     * @param {String} dataSourceId - the corresponding dataSource id
     */
    setStatus(dataSourceId, status) {
        if (dataSourceId in this.dataSourceMap) {
            this.dataSourceMap[dataSourceId].status = status;
            console.warn(status+' DataSource ' + dataSourceId + ' from the synchronizer ');
        }
    }

    close() {
        if (isDefined(this.interval)) {
            clearInterval(this.interval);
            this.interval = null;
        }
        if(isDefined(this.timeoutBuffering)) {
            clearTimeout(this.timeoutBuffering);
            this.timeoutBuffering = null;
        }
        console.log("Data synchronizer terminated successfully");

    }
}

export default DataSynchronizerAlgo;
