import DataConnector from "./DataConnector";
import {Status} from "./Status";

/**
 * Defines the FileConnector to read a File content
 * @extends DataConnector
 * @example
 * import FileConnector from 'osh/dataconnector/FileConnector.js';
 *
 * let paths = ['path1','path2]...];
 * let connector = new FileConnector(paths);
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
class FileConnector extends DataConnector {
    /**
     * @param (string[]) paths - list of file paths
     */
    constructor(paths) {
        super(paths);
        this.opened = false;
    }

    /**
     * Start reading file content
     */
    async connect() {
        if(!this.opened) {
            this.opened = true;
            this.onChangeStatus(Status.CONNECTED);
            const urls = this.getUrl();
            for(let url of urls) {
                this.onMessage(await fetch(url));
            }
            this.onChangeStatus(Status.DISCONNECTED);
            // read is done
            this.opened = false;
        }
    }

    isConnected() {
        return this.opened;
    }
}

export default FileConnector;
