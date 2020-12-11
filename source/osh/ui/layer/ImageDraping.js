/***************************** BEGIN LICENSE BLOCK ***************************

 The contents of this file are subject to the Mozilla Public License, v. 2.0.
 If a copy of the MPL was not distributed with this file, You can obtain one
 at http://mozilla.org/MPL/2.0/.

 Software distributed under the License is distributed on an "AS IS" basis,
 WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 for the specific language governing rights and limitations under the License.

 Copyright (C) 2015-2020 Sensia Software LLC. All Rights Reserved.

 Author: Alex Robin <alex.robin@sensiasoft.com>

 ******************************* END LICENSE BLOCK ***************************/

import {isDefined} from "../../utils/Utils.js";
import Layer from "./Layer.js";

/**
 * @extends Layer
 * @example
 import ImageDraping from 'osh/ui/layer/ImageDraping.js';

 let imageDrapingMarker = new ImageDraping({
      getPlatformLocation: {
        dataSourceIds: [platformLocationDataSource.getId()],
        handler: function (rec) {
          return {
            x: rec.loc.lon,
            y: rec.loc.lat,
            z: rec.loc.alt - 184
          };
        }
      },
      getPlatformOrientation: {
        dataSourceIds: [platformOrientationDataSource.getId()],
        handler: function (rec) {
          return {
            heading : rec.attitude.yaw,
            pitch: rec.attitude.pitch,
            roll: rec.attitude.roll
          };
        }
      },
      getGimbalOrientation: {
        dataSourceIds: [gimbalOrientationDataSource.getId()],
        handler: function (rec) {
          return {
            heading : rec.attitude.yaw,
            pitch: rec.attitude.pitch,
            roll: rec.attitude.roll
          };
        }
      },
      cameraModel: {
        camProj: new Matrix3(747.963/1280.,     0.0,       650.66/1280.,
          0.0,        769.576/738.,  373.206/738.,
          0.0,            0.0,          1.0),
        camDistR: new Cartesian3(-2.644e-01, 8.4e-02, 0.0),
        camDistT: new Cartesian2(-8.688e-04, 6.123e-04)
      },
      icon: 'images/car-location.png',
      iconAnchor: [16, 40],
      imageSrc: videoCanvas
    });
 */
class ImageDraping extends Layer {
    /**
     * @param {Object} properties
     * @param {Number[]} properties.location - [x,y]
     * @param {Object} properties.orientation -
     * @param {Object} properties.gimbalOrientation -
     * @param {Object} properties.cameraModel -
     * @param {Matrix3} properties.cameraModel.camProj -
     * @param {Cartesian3} properties.cameraModel.camDistR -
     * @param {Cartesian2} properties.cameraModel.camDistT -
     * @param {String} properties.icon -
     * @param {Number[]} [properties.iconAnchor=[16,16]] -
     * @param {HTMLElement} properties.imageSrc - source canvas
     * @param {Function} properties.getPlatformLocation -
     * @param {Function} properties.getPlatformOrientation -
     * @param {Function} properties.getGimbalOrientation -
     * @param {Function} properties.getCameraModel -
     * @param {Function} properties.getSnapshot -
     *
     * @param properties
     */
    constructor(properties) {
        super(properties);
        this.properties = properties;
        this.cameraModel = null;
        this.imageSrc = null;
        this.getSnapshot = null;
        this.platformLocation = null;
        this.platformOrientation = null;
        this.gimbalOrientation = null;

        this.options = {};
        var that = this;

        if (isDefined(properties.platformLocation)) {
            this.platformLocation = properties.platformLocation;
        }

        if (isDefined(properties.platformOrientation)) {
            this.platformOrientation = properties.platformOrientation;
        }

        if (isDefined(properties.gimbalOrientation)) {
            this.gimbalOrientation = properties.gimbalOrientation;
        }

        if (isDefined(properties.cameraModel)) {
            this.cameraModel = properties.cameraModel;
        }

        if (isDefined(properties.imageSrc)) {
            this.imageSrc = properties.imageSrc;
        }

        if (isDefined(properties.getPlatformLocation)) {
            let fn = function (rec, timeStamp, options) {
                that.platformLocation = properties.getPlatformLocation.handler(rec, timeStamp, options);
            };
            this.addFn(properties.getPlatformLocation.dataSourceIds, fn);
        }

        if (isDefined(properties.getPlatformOrientation)) {
            let fn = function (rec, timeStamp, options) {
                that.platformOrientation = properties.getPlatformOrientation.handler(rec, timeStamp, options);
            };
            this.addFn(properties.getPlatformOrientation.dataSourceIds, fn);
        }

        if (isDefined(properties.getGimbalOrientation)) {
            let fn = function (rec, timeStamp, options) {
                that.gimbalOrientation = properties.getGimbalOrientation.handler(rec, timeStamp, options);
            };
            this.addFn(properties.getGimbalOrientation.dataSourceIds, fn);
        }

        if (isDefined(properties.getCameraModel)) {
            let fn = function (rec, timeStamp, options) {
                that.cameraModel = properties.getCameraModel.handler(rec, timeStamp, options);
            };
            this.addFn(properties.getCameraModel.dataSourceIds, fn);
        }

        if (isDefined(properties.getSnapshot)) {
            this.getSnapshot = properties.getSnapshot;
        }
    }

    setData(dataSourceId, rec, view, options) {
        if (super.setData(dataSourceId, rec, view, options)) {

            let enabled = true;
            let snapshot = false;
            if (this.getSnapshot !== null) {
                snapshot = this.getSnapshot();
            }

            if (isDefined(view) && enabled &&
              this.platformLocation !== null &&
              this.platformOrientation !== null &&
              this.gimbalOrientation !== null &&
              this.cameraModel !== null &&
              this.imageSrc !== null) {
                view.updateDrapedImage(this, rec.timeStamp, options, snapshot);
                return true;
            }
        }
        return false;
    }
}

export default  ImageDraping;
