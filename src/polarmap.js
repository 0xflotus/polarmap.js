/* Strings */

var t = {
  tileHeader: "Arctic Connect: ",
  attribution: 'Map &copy; <a href="http://arcticconnect.org">ArcticConnect</a>. Data &copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors',
  locationDetectionError: "Location detection error: "
};

/* Projections */

// Globally define projections for Proj4js. If not defined here, then they must
// be defined in tile provider definitions below.
proj4.defs([
  ["EPSG:3571","+proj=laea +lat_0=90 +lon_0=180 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs"],
  ["EPSG:3572","+proj=laea +lat_0=90 +lon_0=-150 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs"],
  ["EPSG:3573","+proj=laea +lat_0=90 +lon_0=-100 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs"],
  ["EPSG:3574","+proj=laea +lat_0=90 +lon_0=-40 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs"],
  ["EPSG:3575","+proj=laea +lat_0=90 +lon_0=10 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs"],
  ["EPSG:3576","+proj=laea +lat_0=90 +lon_0=90 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs"]
]);

var projections = [
  "EPSG:3571",
  "EPSG:3572",
  "EPSG:3573",
  "EPSG:3574",
  "EPSG:3575",
  "EPSG:3576"
];

/* Tile Layer Configuration */

var tiles = {};

// Custom extent for our EPSG:3571-3576 tiles
var extent = 11000000 + 9036842.762 + 667;

for (var i = 0; i < projections.length; i++) {
  var projection = projections[i];
  var epsg = 3571 + i;
  var url = "http://{s}.tiles.arcticconnect.org/osm_" + epsg + "/{z}/{x}/{y}.png";

  tiles[t.tileHeader + projection] = L.PolarMap.tileLayer(url, {
    name: "ac_" + epsg,
    crs: projection,
    minZoom: 0,
    maxZoom: 18,
    tms: false,
    origin: [-extent, extent],
    maxResolution: ((extent - -extent) / 256),
    projectedBounds: L.bounds(L.point(-extent, extent),L.point(extent, -extent)),
    continuousWorld: false,
    noWrap: true,
    attribution: t.attribution
  });
};

// Set up next/prev linked list

for (var i = 0; i < 6; i++) {
  var prev = (i === 0) ? 5 : i - 1;
  var next = (i === 5) ? 0 : i + 1;
  var layer = tiles[t.tileHeader + "EPSG:" + (3571 + i)];
  layer.prev = tiles[t.tileHeader + "EPSG:" + (3571 + prev)];
  layer.next = tiles[t.tileHeader + "EPSG:" + (3571 + next)];
};

/* PolarMap Library Function */

window.PolarMap = L.Class.extend({
  options: {
    geosearch: false,
    locate: false,
    permalink: true
  },

  statics: {
    VERSION: L.PolarMap.version
  },

  initialize: function (id, options) {
    var _this = this,
        container,
        touches;
    L.Util.setOptions(this, options);
    this.tiles = tiles;

    /* Controls */

    this.layersControl = L.control.layers(this.tiles, null);

    this.rotationControls = L.PolarMap.Control.rotation({
      onRotateCW: function() {
        _this.map.loadTileProjection(_this.getBaseLayer().next);
      },

      onRotateCCW: function() {
        _this.map.loadTileProjection(_this.getBaseLayer().prev);
      }
    });

    /* Map */

    this.map = L.PolarMap.map(id, {
      baseLayer: this.tiles[t.tileHeader + "EPSG:3573"],
      center: [90, 0],
      zoom: 4
    });

    this.layersControl.addTo(this.map);
    this.rotationControls.addTo(this.map);

    if (this.options.geosearch) {
      this._initGeosearch();
    }

    if (this.options.locate) {
      this._initLocate();
    }

    if (this.options.permalink) {
      this._initPermalink();
    }

    /* Custom Map Gestures */
    // We retain the last set of touches to determine rotation direction;
    // the sign of event.rotation cannot be trusted.
    container = this.map.getContainer();

    container.addEventListener("touchstart",
      L.PolarMap.Util.debounce(function(e) {
        touches = [];
      })
    );

    container.addEventListener("touchmove",
      L.PolarMap.Util.debounce(function(e) {
        touches.push(e);
        if (touches.length > 10) {
          touches.shift();
        }
      })
    );

    container.addEventListener("touchend",
      L.PolarMap.Util.debounce(function(e) {
        if (touches.length > 0) {
          e.preventDefault();
          var s1 = touches[0].rotation,
              s2 = touches[touches.length - 1].rotation,
              direction = s1 - s2,
              delta = Math.abs(e.rotation);

          if (delta > 45) {
            if (direction > 0) {
              _this.rotateCCW();
            } else {
              _this.rotateCW();
            }
          }
        }
      })
    );
  },

  addLayer: function (layer, options) {
    this.map.addLayer(layer);

    if (typeof(options) !== "undefined" && options.switcher) {
      this.layersControl.addOverlay(layer, options.name);
    }
  },

  getBaseLayer: function () {
    var foundLayer = null;

    for (var layer in this.tiles) {
      if (this.tiles.hasOwnProperty(layer)) {
        if (this.map.hasLayer(this.tiles[layer])) {
          foundLayer = this.tiles[layer];
        }
      }
    }
    return foundLayer;
  },

  rotateCW: function () {
    this.map.loadTileProjection(this.getBaseLayer().next);
  },

  rotateCCW: function () {
    this.map.loadTileProjection(this.getBaseLayer().prev);
  },

  _initGeosearch: function () {
    new L.Control.GeoSearch({
      provider: new L.GeoSearch.Provider.OpenStreetMap(),
      showMarker: false
    }).addTo(this.map);
  },

  _initLocate: function () {
    var _this = this;
    var userLocation = L.circle();

    this.map.on('locationfound', function (e) {
      userLocation.setLatLng(e.latlng);
      userLocation.setRadius(e.accuracy);

      if (!_this.map.hasLayer(userLocation)) {
        userLocation.addTo(_this.map);
      }

      _this._setProjectionForLongitude(e.longitude);
    });

    this.map.on('locationerror', function (e) {
      console.warn(t.locationDetectionError, e);
    });

    this.map.locate();
  },

  _initPermalink: function () {
    var _this = this;
    this.hash = L.PolarMap.Util.hash(this.map, {
      getBaseLayer: function () {
        return _this.getBaseLayer().options.name;
      },

      setBaseLayer: function (name) {
        _this._setBaseLayer(name);
      }
    });
  },

  _setBaseLayer: function (name) {
    var _this = this;

    for (var layer in this.tiles) {
      if (this.tiles.hasOwnProperty(layer)) {
        if (this.tiles[layer].options.name === name) {
          _this.map.loadTileProjection(this.tiles[layer]);
        }
      }
    }
  },

  _setProjectionForLongitude: function (longitude) {
    var value;
    if (longitude >= -180 && longitude <= -165) {
      value = "EPSG:3571";
    } else if (longitude > -165 && longitude <= -125) {
      value = "EPSG:3572";
    } else if (longitude > -125 && longitude <= -70) {
      value = "EPSG:3573";
    } else if (longitude > -70 && longitude <= -15) {
      value = "EPSG:3574";
    } else if (longitude > -15 && longitude <= 50) {
      value = "EPSG:3575";
    } else if (longitude > 50 && longitude <= 135) {
      value = "EPSG:3576";
    } else {
      value = "EPSG:3571";
    }

    this.map.loadTileProjection(this.tiles[t.tileHeader + value]);
  }
});

window.polarMap = function (id, options) {
  return new PolarMap(id, options);
};
