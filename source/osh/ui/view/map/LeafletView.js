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

import View from "../View.js";
import {isDefined, randomUUID} from "../../../utils/Utils.js";
import EventManager from "../../../events/EventManager.js";
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import MapView from "./MapView";

/**
 * This class is in charge of displaying GPS/orientation data by adding a marker to the Leaflet Map object.
 * @extends MapView
 * @example

 import LeafletView from 'osh/ui/view/map/LeafletView.js';

 let leafletMapView = new LeafletView("",
 [{
            layer :  pointMarker,
            name : "Android Phone GPS",
            entityId : androidEntity.id
        },
 {
     layer : new Polyline({
         getLocation : {
             dataSourceIds : [androidPhoneGpsDataSource.getId()],
             handler : function(rec) {
                 return {
                     x : rec.lon,
                     y : rec.lat,
                     z : rec.alt
                 };
             }
         },
         color : 'rgba(0,0,255,0.5)',
         weight : 10,
         opacity : .5,
         smoothFactor : 1,
         maxPoints : 200
     }),
     name : "Android Phone GPS Path",
     entityId : androidEntity.id
 }]
 );
 */
class LeafletView extends MapView {
    /**
     * Create a View.
     * @param {String} parentElementDivId - The div element to attach to
     * @param {Object[]} viewItems - The initial view items to add
     * @param {String} viewItems.name - The name of the view item
     * @param {Layer} viewItems.layer - The layer object representing the view item
     * @param {Object} [options] - the properties of the view
     * @param {Boolean} [options.autoZoomOnFirstMarker=false] - auto zoom on the first added marker
     * @param {Boolean} [options.follow=false] - follow the marker
     * @param {Object} [options.initialView] - Sets the view of the map (geographical center and zoom) with the given animation options. [See details]{@link https://leafletjs.com/reference-1.7.1.html#map-setview}
     * @param {Object[]} [options.overlayLayers] - [L.tileLayer]{@link https://leafletjs.com/reference-1.7.1.html#tilelayer-l-tilelayer} objects to use as overlay layer
     * @param {Object[]} [options.baseLayers] - [L.tileLayer]{@link https://leafletjs.com/reference-1.7.1.html#tilelayer-l-tilelayer} objects to use as base layer
     *
     */
    constructor(parentElementDivId, viewItems, options) {
        super(parentElementDivId, viewItems, options);

        let cssClass = document.getElementById(this.divId).className;
        document.getElementById(this.divId).setAttribute("class", cssClass+" "+this.css);
    }

    beforeAddingItems(options) {
        // inits the map
        this.initMap(options);
    }

    //---------- MAP SETUP --------------//
    /**
     *
     * @private
     */
    initMap(options) {
        // #region snippet_leafletview_initial_view
        let initialView = {
            location: new L.LatLng(0, 0),
            zoom: 3
        };
        // #endregion snippet_leafletview_initial_view
        this.first = true;
        this.follow = false;
        this.autoZoomOnFirstMarker = false;
        let defaultLayers = this.getDefaultLayers();

        let defaultLayer = defaultLayers[0].layer;

        let baseLayers = {};
        let overlays = {};

        baseLayers[defaultLayers[0].name] = defaultLayers[0].layer;
        overlays[defaultLayers[1].name] = defaultLayers[1].layer;
        if (isDefined(options)) {
            if (isDefined(options.initialView)) {
                initialView = {
                    location: new L.LatLng(options.initialView.lat, options.initialView.lon),
                    zoom: options.initialView.zoom
                };
            }
            // checks autoZoom
            if (isDefined(options.autoZoomOnFirstMarker)) {
                this.autoZoomOnFirstMarker = options.autoZoomOnFirstMarker;
            }

            // checks overlayers
            if (isDefined(options.overlayLayers)) {
                overlays = options.overlayLayers;
            }

            // checks baseLayer
            if (isDefined(options.baseLayers)) {
                baseLayers = options.baseLayers;
            }

            if (isDefined(options.follow)) {
                this.follow = options.follow;
            }

            // checks defaultLayer
            if (isDefined(options.defaultLayer)) {
                defaultLayer = options.defaultLayer;
            }
        }

        // sets layers to map
        this.map = new L.Map(this.divId, {
            fullscreenControl: true,
            layers: defaultLayer
        });

        L.control.layers(baseLayers, overlays).addTo(this.map);

        this.map.setView(initialView.location, initialView.zoom);

        //this.initLayers();
    }

    /**
     * Gets the list of default layers.
     * @return {Array}
     */
    getDefaultLayers(options) {
        let maxZoom = 22;
        if (isDefined(options) && options.maxZoom) {
            maxZoom = options.maxZoom;
        }
        // copyrights
        let mbAttr = 'Map data © <a href="http://openstreetmap.org">OpenStreetMap</a> contributors',
            mbUrl = 'http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

        let esriLink = '<a href="http://www.esri.com/">Esri</a>';
        let esriWholink = 'i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community';

        // leaflet layers
        let esriLayer = L.tileLayer(
            'http://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                attribution: '&copy; ' + esriLink + ', ' + esriWholink,
                maxZoom: maxZoom,
                maxNativeZoom: 19
            });

        let streets = L.tileLayer(mbUrl, {id: 'mapbox.streets', attribution: mbAttr, maxZoom: maxZoom});

        return [{
            name: "OSM Streets",
            layer: streets
        }, {
            name: "Esri Satellite",
            layer: esriLayer
        }];
    }

    /**
     * @private
     */
    initLayers() {
        // create the tile layer with correct attribution
        let osmUrl = 'http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
        let osmAttrib = 'Map data © <a href="http://openstreetmap.org">OpenStreetMap</a> contributors';
        let osm = new L.tileLayer(osmUrl, {
            minZoom: 1,
            maxZoom: 22,
            attribution: osmAttrib
        });
        this.map.addLayer(osm);
    }

    /**
     * Add a marker to the map.
     * @param {Object} properties
     * @param {Number} properties.lon
     * @param {Number} properties.lat
     * @param {String} properties.icon - the icon path
     * @param {Integer[]} properties.iconAnchor - offset of the icon ex:[10,10]
     * @param {String} properties.label - label of the tooltip
     * @param {String} properties.description - description of the marker to display into the tooltip
     * @param {String} properties.labelOffset - offset of the label of the tooltip
     * @param {Number} properties.orientation - orientation of the icon in degree
     * @return {string} the id of the new created marker
     */
    addMarker(properties) {
        //create marker
        let marker = null;
        if (properties.icon !== null) {
            let markerIcon = L.icon({
                iconAnchor: properties.iconAnchor,
                iconUrl: properties.icon
            });

            marker = L.marker([properties.lat, properties.lon], {
                icon: markerIcon
            });
        } else {
            marker = L.marker([properties.lat, properties.lon]);
        }

        if (properties.label !== null) {
            marker.bindTooltip(properties.label, {
                permanent: false,
                direction: 'center',
                offset: L.point(properties.labelOffset[0], properties.labelOffset[1])
            });
        }

        let name = properties.hasOwnProperty("name") && properties.label != null ? properties.label : "";
        let desc = properties.hasOwnProperty("description") && properties.description != null ? properties.description : "";
        if (name.length > 0 || desc.length > 0) {
            marker.bindPopup(name + '<div>' + desc + '</div>',{
                offset: L.point(properties.labelOffset[0], properties.labelOffset[1])
            });
        }

        marker.addTo(this.map);
        marker.setRotationAngle(properties.orientation);

        return marker;
    }

    /**
     * Add a polyline to the map.
     * @param {locations} locations - the coordinates [{x, y}]
     * @param {Object} properties
     * @param {String} properties.color
     * @param {Number} properties.weight
     * @param {Number} properties.opacity
     * @param {Number} properties.smoothFactor
     * @return {string} the id of the new created polyline
     */
    addPolyline(locations, properties) {
        let polylinePoints = [];

        if(isDefined(locations) && locations.length > 0) {
            for (let i = 0; i < locations.length; i++) {
                polylinePoints.push(new L.LatLng(
                    locations[i].y,
                    locations[i].x)
                );
            }
        }

        //create path
        let polyline = new L.Polyline(polylinePoints, {
            color: properties.color,
            weight: properties.weight,
            opacity: properties.opacity,
            smoothFactor: properties.smoothFactor
        }).addTo(this.map);

        return polyline;
    }

    /**
     * Updates the marker associated to the layer.
     * @param {PointMarker} layer - The layer allowing the update of the marker
     */
    updateMarker(layer) {
        let marker = this.getMarker(layer);
        if (!isDefined(marker)) {
            // adds a new marker to the leaflet renderer
             const markerObject = this.addMarker({
                lat: layer.location.y,
                lon: layer.location.x,
                orientation: layer.orientation.heading,
                color: layer.color,
                icon: layer.icon,
                iconAnchor: layer.iconAnchor,
                label : layer.label,
                labelColor : layer.labelColor,
                labelSize : layer.labelSize,
                labelOffset : layer.labelOffset,
                name : layer.viewItem.name,
                description : layer.viewItem.description
            });
            this.addMarkerToLayer(layer, markerObject);
        }

        // get the current marker corresponding to the current markerId value of the PointMarker
        marker = this.getMarker(layer);
        // updates position
        let lon = layer.location.x;
        let lat = layer.location.y;

        if (!isNaN(lon) && !isNaN(lat)) {
            let newLatLng = new L.LatLng(lat, lon);
            marker.setLatLng(newLatLng);
            if((this.first && this.autoZoomOnFirstMarker) || this.follow) {
                const markerBounds = L.latLngBounds([newLatLng ]);
                this.map.fitBounds(markerBounds, {
                    maxZoom: layer.zoomLevel
                });
                if(this.first) {
                    this.first = false;
                }
            }
        }

        // updates orientation
        if(isDefined(layer.orientation)) {
            marker.setRotationAngle(layer.orientation.heading);
        }

        if (layer.icon !== null && marker._icon.iconUrl !== layer.icon) {
            // updates icon
            let markerIcon = L.icon({
                iconAnchor: layer.iconAnchor,
                iconUrl: layer.icon
            });
            marker.setIcon(markerIcon);
        }
    }

    /**
     * Abstract method to remove a marker from its corresponding layer.
     * This is library dependant.
     * @param {Object} marker - The Map marker object
     */
    removeMarkerFromLayer(marker) {
        this.map.removeLayer(marker);
    }

    /**
     * Abstract method to remove a polyline from its corresponding layer.
     * This is library dependant.
     * @param {Object} polyline - The Map polyline object
     */
    removePolylineFromLayer(polyline) {
        this.map.removeLayer(polyline);
    }

    /**
     * Updates the polyline associated to the layer.
     * @param {Polyline} layer - The layer allowing the update of the polyline
     */
    updatePolyline(layer) {
        let polyline = this.getPolyline(layer);
        if (isDefined(polyline)) {
            // removes the layer
           this.removePolylineFromLayer(polyline);
        }

        // adds a new polyline to the leaflet renderer
        const polylineObj = this.addPolyline(layer.locations[layer.polylineId],{
            color: layer.color,
            weight: layer.weight,
            locations: layer.locations,
            maxPoints: layer.maxPoints,
            opacity: layer.opacity,
            smoothFactor: layer.smoothFactor
        });
        this.addPolylineToLayer(layer, polylineObj);
    }

    attachTo(parentElement) {
        super.attachTo(parentElement);
        // Fix leaflet bug when resizing the div parent container
        this.map.invalidateSize();
    }

    onResize() {
        super.onResize();
        let that = this;
        setTimeout(function(){ that.map.invalidateSize()}, 100);

    }

    onChange(data) {}
}

/***  little hack starts here ***/

L.Map = L.Map.extend({
    openPopup: function (popup) {
        this._popup = popup;
        return this.addLayer(popup).fire('popupopen', {
            popup: this._popup
        });
    }
});

// Defines rotated marker
(function () {
    // save these original methods before they are overwritten
    let proto_initIcon = L.Marker.prototype._initIcon;
    let proto_setPos = L.Marker.prototype._setPos;

    let oldIE = (L.DomUtil.TRANSFORM === 'msTransform');

    L.Marker.addInitHook(function () {
        let iconAnchor = this.options.icon.options.iconAnchor;
        if (iconAnchor) {
            iconAnchor = (iconAnchor[0] + 'px ' + iconAnchor[1] + 'px');
        }
        this.options.rotationOrigin = this.options.rotationOrigin || iconAnchor || 'center bottom';
        this.options.rotationAngle = this.options.rotationAngle || 0;
    });

    L.Marker.include({
        _initIcon: function () {
            proto_initIcon.call(this);
        },

        _setPos: function (pos) {
            proto_setPos.call(this, pos);

            if (this.options.rotationAngle) {
                this._icon.style[L.DomUtil.TRANSFORM + 'Origin'] = this.options.rotationOrigin;

                if (oldIE) {
                    // for IE 9, use the 2D rotation
                    this._icon.style[L.DomUtil.TRANSFORM] = ' rotate(' + this.options.rotationAngle + 'deg)';
                } else {
                    // for modern browsers, prefer the 3D accelerated version
                    this._icon.style[L.DomUtil.TRANSFORM] += ' rotateZ(' + this.options.rotationAngle + 'deg)';
                }
            }
        },

        setRotationAngle: function (angle) {
            this.options.rotationAngle = angle;
            this.update();
            return this;
        },

        setRotationOrigin: function (origin) {
            this.options.rotationOrigin = origin;
            this.update();
            return this;
        }
    });
})();


/***  end of hack ***/

export default  LeafletView;
