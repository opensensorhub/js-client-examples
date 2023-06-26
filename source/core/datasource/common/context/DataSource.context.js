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

class DataSourceContext {
    constructor() {
        this.connector = undefined;
        this.properties = undefined;
    }

    async init(properties) {
        // this.parser.init(properties);
        this.properties = properties;
        this.connector = await this.createDataConnector(properties);
        this.connector.onChangeStatus = this.onChangeStatus.bind(this);
        this.connector.onMessage = this.onMessage.bind(this);
    }

    async createDataConnector(properties) {

    }

    connect() {
    }

    async onMessage(messages, format) {

    }

    async disconnect() {
    }

    handleData(data) {
    }

    isConnected() {
        return false;
    }

    onChangeStatus(status) {}
}

export default DataSourceContext;
