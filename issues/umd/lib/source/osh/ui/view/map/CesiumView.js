/***************************** BEGIN LICENSE BLOCK ***************************

 The contents of this file are subject to the Mozilla Public License, v. 2.0.
 If a copy of the MPL was not distributed with this file, You can obtain one
 at http://mozilla.org/MPL/2.0/.

 Software distributed under the License is distributed on an "AS IS" basis,
 WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 for the specific language governing rights and limitations under the License.

 Copyright (C) 2015-2020 Sensia Software LLC. All Rights Reserved.

 Author: Mathieu Dhainaut <mathieu.dhainaut@gmail.com>
 Author: Alex Robin <alex.robin@sensiasoft.com>

 ******************************* END LICENSE BLOCK ***************************/

import View from "../View.js";
import {isDefined, randomUUID} from "../../../utils/Utils.js";

import {
  when,
  Cartographic,
  Cartesian3,
  Cartesian2,
  knockout,
  Color,
  HorizontalOrigin,
  VerticalOrigin,
  HeightReference,
  Math,
  Transforms,
  Matrix3,
  Matrix4,
  MaterialAppearance,
  Material,
  sampleTerrain,
  GeometryInstance,
  RectangleGeometry,
  Rectangle,
  Primitive,
  createDefaultImageryProviderViewModels,
  Viewer,
  WebMapServiceImageryProvider,
  EllipsoidTerrainProvider,
  NearFarScalar,
  HeadingPitchRoll,
  HeadingPitchRange,
  Ellipsoid, defined,
  EncodedCartesian3, CesiumTerrainProvider,
  ScreenSpaceEventType, SceneTransforms
} from 'cesium';

import ImageDrapingVS from "./shaders/ImageDrapingVS.js";
import ImageDrapingFS from "./shaders/ImageDrapingFS.js";
import "cesium/Build/Cesium/Widgets/widgets.css";
import MapView from "./MapView";

/**
 * This class is in charge of displaying GPS/orientation data by adding a marker to the Cesium object.
 * @extends MapView
 * @example

 import CesiumView from 'osh/ui/view/map/CesiumView.js';

 // style it with a moving point marker
 let pointMarker = new PointMarkerLayer({
	dataSourceId: gpsDataSource.id,
	getLocation: (rec) => ({
		x: rec.location.lon,
		y: rec.location.lat
	}),
	orientation: {
		heading: 0
	},
	icon: 'images/car-location.png',
	iconAnchor: [16, 40]
});

 // #region snippet_cesium_location_view
 // create Cesium view
 let cesiumView = new CesiumView({
	container: 'cesium-container',
	layers: [pointMarker]
});
 */
class CesiumView extends MapView {

  /**
   * Create a View.
   * @param {Object} [properties={}] - the properties of the view
   * @param {String} properties.container - The div element to attach to
   * @param {Object[]}  [properties.layers=[]] - The initial layers to add
   * @param {Boolean} [properties.autoZoomOnFirstMarker=false] - auto zoom on the first added marker
   *
   */
  constructor(properties) {
    super({
      supportedLayers: ['marker','draping'],
      ...properties
    });

    let cssClass = document.getElementById(this.divId).className;
    document.getElementById(this.divId).setAttribute("class", cssClass + " " + this.css);

    this.imageDrapingPrimitive = null;
    this.imageDrapingPrimitiveReady = false;
    this.frameCount = 0;

    this.captureCanvas = document.createElement('canvas');
    this.captureCanvas.width = 640;
    this.captureCanvas.height = 480;
  }

  /**
   * Updates the marker associated to the layer.
   * @param {PointMarkerLayer.props} props - The layer properties allowing the update of the marker
   */
  updateMarker(props) {
    // for the first data, we can receive the orientation before the first location point
    if(!isDefined(props.location)) {
      return;
    }

    let marker = this.getMarker(props);
    if (!isDefined(marker)) {
      const markerObj = this.addMarker({
        lat : props.location.y,
        lon : props.location.x,
        alt : props.location.z,
        orientation : props.orientation,
        icon : props.icon,
        iconAnchor : props.iconAnchor,
        label : props.label,
        labelColor : props.labelColor,
        labelSize : props.labelSize,
        labelOffset : props.labelOffset,
        name : props.name,
        description : props.description,
        id: props.id+"$"+props.markerId
      });

      this.addMarkerToLayer(props, markerObj);
    }

    this.updateMapMarker(props, {
      lat : props.location.y,
      lon : props.location.x,
      alt : props.location.z,
      orientation : props.orientation,
      icon : props.icon,
      label : props.label,
      labelColor : props.labelColor,
      labelSize : props.labelSize,
      defaultToTerrainElevation: props.defaultToTerrainElevation
    });
  }

  /**
   * Updates the image draping associated to the layer.
   * @param {ImageDraping.props} props - The layer properties allowing the update of the image draping
   */
  updateDrapedImage(props) {

    if(!isDefined(props.platformLocation)) {
      return;
    }

    const llaPos = props.platformLocation;
    const DTR = Math.PI/180;
    const attitude = props.platformOrientation;
    const gimbal = props.gimbalOrientation;

    ///////////////////////////////////////////////////////////////////////////////////
    // compute rotation matrix to transform lookrays from camera frame to ECEF frame //
    ///////////////////////////////////////////////////////////////////////////////////
    const camPos = Cartesian3.fromDegrees(llaPos.x, llaPos.y, llaPos.z);
    const nedTransform = Transforms.northEastDownToFixedFrame(camPos);
    const camRot = new Matrix3();
    Matrix4.getMatrix3(nedTransform, camRot);
    const rotM = new Matrix3();

    if(isDefined(attitude)) {
      // UAV heading, pitch, roll (given in NED frame)
      const uavHeading = Matrix3.fromRotationZ(attitude.heading * DTR, rotM);
      Matrix3.multiply(camRot, uavHeading, camRot);
      const uavPitch = Matrix3.fromRotationY(attitude.pitch * DTR, rotM);
      Matrix3.multiply(camRot, uavPitch, camRot);
      const uavRoll = Matrix3.fromRotationX(attitude.roll * DTR, rotM);
      Matrix3.multiply(camRot, uavRoll, camRot);
    }

    // gimbal angles (on solo gimbal, order is yaw, roll, pitch!)
    if(isDefined(gimbal)) {
      const gimbalYaw = Matrix3.fromRotationZ(gimbal.heading * DTR, rotM);
      Matrix3.multiply(camRot, gimbalYaw, camRot);
      const gimbalRoll = Matrix3.fromRotationX(gimbal.roll * DTR, rotM);
      Matrix3.multiply(camRot, gimbalRoll, camRot);
      const gimbalPitch = Matrix3.fromRotationY((90 + gimbal.pitch) * DTR, rotM);
      Matrix3.multiply(camRot, gimbalPitch, camRot);
    }

    // transform to camera frame
    var img2cam = Matrix3.fromRotationZ(90 * DTR, rotM);
    Matrix3.multiply(camRot, img2cam, camRot);

    ////////////////////////////////////////////////////////////////////////////////////

    const camProj = props.cameraModel.camProj;
    const camDistR = props.cameraModel.camDistR;
    const camDistT = props.cameraModel.camDistT;

    let imgSrc = props.imageSrc;

    {
      let snapshot = false;
      if (props.getSnapshot !== null) {
        snapshot = props.getSnapshot();
      }
      // snapshot
      if (props.snapshot) {
        var ctx = this.captureCanvas.getContext('2d');
        ctx.drawImage(imgSrc, 0, 0, this.captureCanvas.width, this.captureCanvas.height);
        imgSrc = this.captureCanvas;
      }

      const encCamPos = EncodedCartesian3.fromCartesian(camPos);
      const appearance = new MaterialAppearance({
        material : new Material({
          fabric : {
            type : 'Image',
            uniforms : {
              image : imgSrc,
              camPosHigh : encCamPos.high,
              camPosLow : encCamPos.low,
              camAtt: Matrix3.toArray(Matrix3.transpose(camRot, new Matrix3())),
              camProj: Matrix3.toArray(camProj),
              camDistR: camDistR,
              camDistT: camDistT
            }
          }
        }),
        vertexShaderSource: ImageDrapingVS,
        fragmentShaderSource: ImageDrapingFS
      });

      if (this.imageDrapingPrimitive === null || snapshot) {
        if (this.imageDrapingPrimitive === null)
          this.imageDrapingPrimitive = {};

        const promise = sampleTerrain(this.viewer.terrainProvider, 11, [Cartographic.fromDegrees(llaPos.x, llaPos.y)]);
        const that = this;
        when(promise, function(updatedPositions) {
          //console.log(updatedPositions[0]);
          var newImageDrapingPrimitive = that.viewer.scene.primitives.add(new Primitive({
            geometryInstances: new GeometryInstance({
              geometry: new RectangleGeometry({
                rectangle: Rectangle.fromDegrees(llaPos.x-0.1, llaPos.y-0.1, llaPos.x+0.1, llaPos.y+0.1),
                height: updatedPositions[0].height,
                extrudedHeight: llaPos.z-1
              })
            }),
            appearance: appearance
          }));

          if (!snapshot)
            that.imageDrapingPrimitive = newImageDrapingPrimitive;

          that.viewer.scene.primitives.raiseToTop(that.imageDrapingPrimitive);
          that.imageDrapingPrimitiveReady = true;
        });

      } else if (this.imageDrapingPrimitiveReady) {
        this.imageDrapingPrimitive.appearance = appearance;
      }
    }

    this.frameCount++;
  }

  //---------- MAP SETUP --------------//
  beforeAddingItems(options) {
    this.first = true;

    const imageryProviders = createDefaultImageryProviderViewModels();
    this.viewer = new Viewer(this.divId, {
      baseLayerPicker: true,
      imageryProviderViewModels: imageryProviders,
      selectedImageryProviderViewModel: imageryProviders[6],
      timeline: false,
      homeButton: false,
      navigationInstructionsInitiallyVisible: false,
      navigationHelpButton: false,
      geocoder: true,
      fullscreenButton: false,
      showRenderLoopErrors: true,
      animation: false,
      scene3DOnly: true // for draw layer
    });

    this.viewer.terrainProvider = new EllipsoidTerrainProvider();
    this.viewer.scene.copyGlobeDepth = true;
    this.viewer.scene._environmentState.useGlobeDepthFramebuffer = true;

    // inits callbacks
    // Get default left click handler for when a feature is not picked on left click
    const that = this;
    const onClick = (movement) => {
      // Pick a new feature
      const pickedFeature = that.viewer.scene.pick(movement.position);
      if (!isDefined(pickedFeature) || !isDefined(pickedFeature.id)) {
        return;
      }
      const mId = that.getMarkerId(pickedFeature.id.id);
      if (!isDefined(mId)) {
        return;
      }
      const sId = that.getLayerId(pickedFeature.id.id);
      if (!isDefined(sId)) {
        return;
      }
      const layer = that.getLayer(sId);
      if (!isDefined(layer)) {
        return;
      }

      that.viewer.selectedEntity = pickedFeature.id;
      that.viewer.selectedEntity.name = mId;
      pickedFeature.pixel = movement.position;
      that.onMarkerLeftClick(mId,pickedFeature, layer.props, {})
    };

    const onRightClick = (movement) => {
      // Pick a new feature
      const pickedFeature = that.viewer.scene.pick(movement.position);
      if (!isDefined(pickedFeature) || !isDefined(pickedFeature.id)) {
        return;
      }
      const mId = that.getMarkerId(pickedFeature.id.id);
      if (!isDefined(mId)) {
        return;
      }
      const sId = that.getLayerId(pickedFeature.id.id);
      if (!isDefined(sId)) {
        return;
      }
      const layer = that.getLayer(sId);
      if (!isDefined(layer)) {
        return;
      }

      that.viewer.selectedEntity = pickedFeature.id;
      that.viewer.selectedEntity.name = mId;
      pickedFeature.pixel = movement.position;
      that.onMarkerRightClick(mId,pickedFeature, layer.props, {})
    };

    const onHover = (movement) => {
      const pickedFeature = that.viewer.scene.pick(movement.endPosition);
      if (!isDefined(pickedFeature) || !isDefined(pickedFeature.id)) {
        return;
      }
      const mId = that.getMarkerId(pickedFeature.id.id);
      if (!isDefined(mId)) {
        return;
      }
      const sId = that.getLayerId(pickedFeature.id.id);
      if (!isDefined(sId)) {
        return;
      }
      const layer = that.getLayer(sId);
      if (!isDefined(layer)) {
        return;
      }
      pickedFeature.pixel = movement.endPosition;
      that.onMarkerHover(mId,pickedFeature, layer.props, {})
    };

    this.viewer.screenSpaceEventHandler.setInputAction(onClick, ScreenSpaceEventType.LEFT_CLICK);
    this.viewer.screenSpaceEventHandler.setInputAction(onRightClick, ScreenSpaceEventType.RIGHT_CLICK);
    this.viewer.screenSpaceEventHandler.setInputAction(onHover, ScreenSpaceEventType.MOUSE_MOVE);

  }

  /**
   * Abstract method to remove a marker from its corresponding layer.
   * This is library dependent.
   * @param {Object} marker - The Map marker object
   */
  removeMarkerFromLayer(marker) {
    this.viewer.entities.remove(marker);
  }

  /**
   * Add a marker to the map.
   * @param {Object} properties
   * @param {Number} properties.lon
   * @param {Number} properties.lat
   * @param {String} properties.icon - the icon path
   * @param {String} properties.label - label of the tooltip
   * @param {String} properties.description - description of the marker to display into the tooltip
   * @param {Object} properties.orientation.heading - orientation of the icon in degree
   * @return {Entity} the new created entity
   */
  addMarker(properties) {

    let imgIcon = 'images/cameralook.png';
    if (properties.icon !== null) {
      imgIcon = properties.icon;
    }
    const isModel = imgIcon.endsWith(".glb");
    const label = properties.hasOwnProperty("label") && properties.label != null ? properties.label : null;
    const fillColor = properties.labelColor || '#FFFFFF';
    const labelSize = properties.labelSize || 16;
    const iconOffset = new Cartesian2(-properties.iconAnchor[0], -properties.iconAnchor[1]);
    const labelOffset = new Cartesian2(properties.labelOffset[0], properties.labelOffset[1]);

    const name = properties.hasOwnProperty("name") && properties.name != null ? properties.name :
        label != null ? label : "Selected Marker";
    const desc = properties.hasOwnProperty("description") && properties.description != null ? properties.description : null;
    const color = properties.hasOwnProperty("color") && isDefined(properties.color) ?
        Color.fromCssColorString(properties.color) : Color.YELLOW;

    var geom;
    let lonLatAlt = [0,0,0];
    if(isDefined(properties.location)) {
      lonLatAlt = [properties.location.x, properties.location.y, properties.location.z || 0]
    }
    if (isModel) {
      geom = {
        name: name,
        description: desc,
        position : Cartesian3.fromDegrees(lonLatAlt[0], lonLatAlt[1], lonLatAlt[2]),
        label: {
          text: label,
          font: labelSize + 'px sans-serif',
          scaleByDistance: new NearFarScalar(150, 1.0, 1e6, 0.0),
          fillColor: Color.fromCssColorString(fillColor),
          horizontalOrigin: HorizontalOrigin.CENTER,
          verticalOrigin: VerticalOrigin.TOP,
          pixelOffset : labelOffset
        },
        model : {
          uri: imgIcon,
          scale: 4,
          modelM: Matrix4.IDENTITY.clone(),
          color: color
        }
      };
    } else {
      let rot = 0;
      if (isDefined(properties.orientation) && isDefined(properties.orientation.heading)) {
        rot = properties.orientation.heading;
      }

      geom = {
        name: name,
        description: desc,
        position : Cartesian3.fromDegrees(lonLatAlt[0], lonLatAlt[1], lonLatAlt[2]),
        label: {
          text: label,
          font: labelSize + 'px sans-serif',
          scaleByDistance: new NearFarScalar(150, 1.0, 1e6, 0.0),
          fillColor: Color.fromCssColorString(fillColor),
          horizontalOrigin: HorizontalOrigin.CENTER,
          verticalOrigin: VerticalOrigin.TOP,
          pixelOffset : labelOffset,
          pixelOffsetScaleByDistance: new NearFarScalar(150, 1.0, 1e6, 0.0)
        },
        billboard : {
          image : imgIcon,
          scaleByDistance: new NearFarScalar(1000, 1.0, 10e6, 0.0),
          alignedAxis : Cartesian3.UNIT_Z, // Z means rotation is from north
          rotation : Math.toRadians(rot),
          horizontalOrigin : HorizontalOrigin.LEFT,
          verticalOrigin: VerticalOrigin.TOP,
          pixelOffset : iconOffset,
          pixelOffsetScaleByDistance: new NearFarScalar(1000, 1.0, 10e6, 0.0),
          eyeOffset : new Cartesian3(0, 0, -1) // make sure icon always displays in front
        }
      };
    }

    if (properties.hasOwnProperty('description')) {
      geom.description = properties.description;
    }

    geom.id = properties.id;
    return this.viewer.entities.add(geom);
  }

  /**
   * Updates the marker associated to the layer.
   * @param {Layer} layer - The layer allowing the update of the marker
   * @param {Object} properties -
   * @param {Object} properties.lon -
   * @param {Object} properties.lat -
   * @param {Object} properties.alt -
   * @param {Object} properties.orientation -
   * @param {Object} properties.icon -
   * @param {Object} properties.defaultToTerrainElevation -
   * @param {Object} properties.selected -
   */
  updateMapMarker(layer, properties) {
    const lon = properties.lon;
    const lat = properties.lat;
    let alt = properties.alt;
    const orient = properties.orientation;
    const labelColor = properties.labelColor;
    const imgIcon = properties.icon;
    var label = properties.label;
    let defaultToTerrainElevation = properties.defaultToTerrainElevation;

    if (!isNaN(lon) && !isNaN(lat)) {
      let marker = this.getMarker(layer);

      // get ground altitude if non specified
      if (isDefined(alt) || isNaN(alt)) {
        alt = this.getAltitude(lat, lon);
        if (alt > 1)
          alt += 0.3;
      }

      // update position
      const pos = Cartesian3.fromDegrees(lon, lat, alt);
      marker.position = pos;

      // update orientation
      if (isDefined(orient)) {
        const DTR = Math.PI/180.;
        const heading = orient.heading;
        const pitch = 0.0;
        const roll = 0.0;
        const quat = Transforms.headingPitchRollQuaternion(pos, new HeadingPitchRoll(heading*DTR, /*roll*DTR*/0.0, pitch*DTR)); // inverse roll and pitch to go from NED to ENU
        marker.orientation = quat;
        if (marker.billboard)
          marker.billboard.rotation = Math.toRadians(heading);
      }

      if (isDefined(label)) {
        marker.label.text = label;
      }

      if (isDefined(labelColor)) {
        marker.label.fillColor = Color.fromCssColorString(labelColor);
      }
      // update icon or model
      if (marker.billboard) {
        if (defaultToTerrainElevation) {
          marker.billboard.heightReference = HeightReference.CLAMP_TO_GROUND;
        }
        marker.billboard.image = imgIcon;
      }
      else if (marker.model)  {
        if (defaultToTerrainElevation) {
          marker.model.heightReference = HeightReference.CLAMP_TO_GROUND;
        }
        marker.model.uri = imgIcon;
      }

      // update label
      //marker.label = properties.label;
      //if (properties.labelColor != null)
      //	marker.label.fillColor = Cesium.Color.fromCssColorString(properties.labelColor);

      // update billboard aligned axis depending on camera angle
      if (marker.billboard) {
        if (this.viewer.camera.pitch < -Math.PI / 4)
          marker.billboard.alignedAxis = Cartesian3.UNIT_Z;
        else
          marker.billboard.alignedAxis = Cartesian3.ZERO;
      }
      // zoom map if first marker update
      if (this.first) {
        this.viewer.zoomTo(this.viewer.entities, new HeadingPitchRange(Math.toRadians(0), Math.toRadians(-90), 2000));
        this.first = false;
      }

      if (properties.selected) {
        this.viewer.selectedEntity = marker;
      }
    }
  }

  /**
   *
   * @private
   */
  getAltitude(lat, lon) {
    var position = Cartesian3.fromDegrees(lon, lat, 0, this.viewer.scene.globe.ellipsoid, new Cartesian3());
    var altitude = this.viewer.scene.globe.getHeight(Ellipsoid.WGS84.cartesianToCartographic(position));

    if (altitude === 'undefined' || altitude <= 0)
      altitude = 0.1;
    return altitude;
  }

  /**
   *
   * @param type
   * @param url
   * @param layers
   * @param imageFormat
   * @param options
   * @return {*}
   */
  addImageryProvider(type, url, layers, imageFormat, options) {
    let minLOD = 0;
    let maxLOD;

    if (options.hasOwnProperty('minLOD')){
      minLOD = options.minLOD;
    }
    if (options.hasOwnProperty('maxLOD')){
      maxLOD = options.maxLOD;
    }

    let imageryProvider;
    if (type === 'wms') {
      imageryProvider = new WebMapServiceImageryProvider({
        url: url,
        layers: layers,
        minimumLevel: minLOD,
        maximumLevel: maxLOD,
        parameters: {
          transparent: 'true',
          format: 'image/' + imageFormat
        }
      });
    }
    // imageryProvider.alpha = 0.5;
    this.viewer.imageryLayers.addImageryProvider(imageryProvider);
    return imageryProvider;
  }
}

export default  CesiumView;
