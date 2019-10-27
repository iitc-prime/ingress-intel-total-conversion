/// SETUP /////////////////////////////////////////////////////////////
// these functions set up specific areas after the boot function
// created a basic framework. All of these functions should only ever
// be run once.

window.setupLargeImagePreview = function () {
    $('#portaldetails').on('click', '.imgpreview', function (e) {
        var img = this.querySelector('img');
        //dialogs have 12px padding around the content
        var dlgWidth = Math.max(img.naturalWidth+24,500);
        // This might be a case where multiple dialogs make sense, for example
        // someone might want to compare images of multiple portals.  But
        // usually we only want to show one version of each image.
        // To support that, we'd need a unique key per portal.  Example, guid.
        // So that would have to be in the html fetched into details.

        var preview = new Image(img.width, img.height);
        preview.src = img.src;
        preview.style = 'margin: auto; display: block';
        var title = e.delegateTarget.querySelector('.title').innerText;
        dialog({
                   html: preview,
                   title: title,
                   id: 'iitc-portal-image',
                   width: dlgWidth,
               });
    });
}

// Setup the function to record the on/off status of overlay layerGroups
window.setupLayerChooserStatusRecorder = function() {
    /*
  // Record already added layerGroups
  $.each(window.layerChooser._layers, function(ind, chooserEntry) {
    if(!chooserEntry.overlay) return true;
    var display = window.map.hasLayer(chooserEntry.layer);
    window.updateDisplayedLayerGroup(chooserEntry.name, display);
  });

  // Record layerGroups change
  window.map.on('overlayadd overlayremove', function(e) {
    var display = (e.type === 'overlayadd');
    window.updateDisplayedLayerGroup(e.name, display);
  });
  */
}

window.setupStyles = function() {
    $('head').append('<style>' +
                     [ '#largepreview.enl img { border:2px solid '+COLORS[TEAM_ENL]+'; } ',
                      '#largepreview.res img { border:2px solid '+COLORS[TEAM_RES]+'; } ',
                      '#largepreview.none img { border:2px solid '+COLORS[TEAM_NONE]+'; } ',
                      '#chatcontrols { bottom: '+(CHAT_SHRINKED+22)+'px; }',
                      '#chat { height: '+CHAT_SHRINKED+'px; } ',
                      '.leaflet-right { margin-right: '+(SIDEBAR_WIDTH+1)+'px } ',
                      '#updatestatus { width:'+(SIDEBAR_WIDTH+2)+'px;  } ',
                      '#sidebar { width:'+(SIDEBAR_WIDTH + HIDDEN_SCROLLBAR_ASSUMED_WIDTH + 1 /*border*/)+'px;  } ',
                      '#sidebartoggle { right:'+(SIDEBAR_WIDTH+1)+'px;  } ',
                      '#scrollwrapper  { width:'+(SIDEBAR_WIDTH + 2*HIDDEN_SCROLLBAR_ASSUMED_WIDTH)+'px; right:-'+(2*HIDDEN_SCROLLBAR_ASSUMED_WIDTH-2)+'px } ',
                      '#sidebar > * { width:'+(SIDEBAR_WIDTH+1)+'px;  }'].join("\n")
                     + '</style>');
}

window.setupIcons = function() {
    $(['<svg>',
       // Material Icons

       // portal_detail_display.js
       '<symbol id="ic_place_24px" viewBox="0 0 24 24">',
       '<path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z"/>',
       '</symbol>',
       '</svg>'].join('\\n')).appendTo('body');
}

window.setupMap = function() {
    $('#map').text('');
    var maps = [
                new window.MapboxGL('map'),
                new window.Leaflet('map'),
            ];
    for (var i = 0; i < maps.length; i++) {
        var map = maps[i];
        if (!map.init())
            continue;
        map.setup();
        window.map = map;
        break;
    }

    window.layerManager = new window.LayerManager();
    for (var i = 0; i < 9; i++) {
        window.layerManager.addLayer('p' + i, 'P<sub>' + i + '</sub>');
    }
    window.layerManager.addLayer('link', '☍');
    window.layerManager.addLayer('field', '△');
    window.layerManager.addLayer('building', '▱', false);

    // listen for changes and store them in cookies
    addHook('mapMoveEnd', window.storeMapPosition);
    addHook('mapRotateEnd', window.storeMapPosition);
    addHook('mapPitchEnd', window.storeMapPosition);
    addHook('mapMoveEnd', function() {
        // two limits on map position
        // we wrap longitude (the L.LatLng 'wrap' method) - so we don't find ourselves looking beyond +-180 degrees
        // then latitude is clamped with the clampLatLng function (to the 85 deg north/south limits)
        var center = this.map.getCenter();
        var newPos = clampLatLng(center);
        if (center.lat !== newPos.lat)
            window.map.panTo(newPos,{animate:false});
    });

    // map update status handling & update map hooks
    // ensures order of calls
    addHook('mapMoveStart', function() { window.mapRunsUserAction = true; window.requests.abort(); window.startRefreshTimeout(-1); });
    addHook('mapMoveEnd', function() { window.mapRunsUserAction = false; window.startRefreshTimeout(ON_MOVE_REFRESH*1000); });

    // set a 'moveend' handler for the map to clear idle state. e.g. after mobile 'my location' is used.
    // possibly some cases when resizing desktop browser too
    addHook('mapMoveEnd', idleReset);

    window.addResumeFunction(function() { window.startRefreshTimeout(ON_MOVE_REFRESH*1000); });

    // start the refresh process with a small timeout, so the first data request happens quickly
    // (the code originally called the request function directly, and triggered a normal delay for the next refresh.
    //  however, the moveend/zoomend gets triggered on map load, causing a duplicate refresh. this helps prevent that
    window.startRefreshTimeout(ON_MOVE_REFRESH*1000);

    window.mapDataRequest = new MapDataRequest();
    window.mapDataRequest.start();
};

// renders player details into the website. Since the player info is
// included as inline script in the original site, the data is static
// and cannot be updated.
window.setupPlayerStat = function() {
    // stock site updated to supply the actual player level, AP requirements and XM capacity values
    var level = PLAYER.verified_level;
    PLAYER.level = level; //for historical reasons IITC expects PLAYER.level to contain the current player level

    var n = window.PLAYER.nickname;
    PLAYER.nickMatcher = new RegExp('\\b('+n+')\\b', 'ig');

    var ap = parseInt(PLAYER.ap);
    var thisLvlAp = parseInt(PLAYER.min_ap_for_current_level);
    var nextLvlAp = parseInt(PLAYER.min_ap_for_next_level);

    if (nextLvlAp) {
        var lvlUpAp = digits(nextLvlAp-ap);
        var lvlApProg = Math.round((ap-thisLvlAp)/(nextLvlAp-thisLvlAp)*100);
    } // else zero nextLvlAp - so at maximum level(?)

    var xmMax = parseInt(PLAYER.xm_capacity);
    var xmRatio = Math.round(PLAYER.energy/xmMax*100);

    var cls = PLAYER.team === 'RESISTANCE' ? 'res' : 'enl';


    var t = 'Level:\t' + level + '\n'
            + 'XM:\t' + PLAYER.energy + ' / ' + xmMax + '\n'
            + 'AP:\t' + digits(ap) + '\n'
            + (nextLvlAp > 0 ? 'level up in:\t' + lvlUpAp + ' AP' : 'Maximum level reached(!)')
            + '\n\Invites:\t'+PLAYER.available_invites
            + '\n\nNote: your player stats can only be updated by a full reload (F5)';

    $('#playerstat').html(''
                          + '<h2 title="'+t+'">'+level+'&nbsp;'
                          + '<div id="name">'
                          + '<span class="'+cls+'">'+PLAYER.nickname+'</span>'
                          + '<a href="/_ah/logout?continue=https://www.google.com/accounts/Logout%3Fcontinue%3Dhttps://appengine.google.com/_ah/logout%253Fcontinue%253Dhttps://intel.ingress.com/intel%26service%3Dah" id="signout">sign out</a>'
                          + '</div>'
                          + '<div id="stats">'
                          + '<sup>XM: '+xmRatio+'%</sup>'
                          + '<sub>' + (nextLvlAp > 0 ? 'level: '+lvlApProg+'%' : 'max level') + '</sub>'
                          + '</div>'
                          + '</h2>'
                          ).addClass(cls);
}

window.setupSidebarToggle = function() {
    $('#sidebartoggle').on('click', function() {
        var toggle = $('#sidebartoggle');
        var sidebar = $('#scrollwrapper');
        if(sidebar.is(':visible')) {
            sidebar.hide().css('z-index', 1);
            $('.leaflet-right').css('margin-right','0');
            toggle.html('<span class="toggle open"></span>');
            toggle.css('right', '0');
        } else {
            sidebar.css('z-index', 1001).show();
            window.resetScrollOnNewPortal();
            $('.leaflet-right').css('margin-right', SIDEBAR_WIDTH+1+'px');
            toggle.html('<span class="toggle close"></span>');
            toggle.css('right', SIDEBAR_WIDTH+1+'px');
        }
        $('.ui-tooltip').remove();
    });
}

window.setupTooltips = function(element) {
    element = element || $(document);
    element.tooltip({
                        // disable show/hide animation
                        show: { effect: 'none', duration: 0, delay: 350 },
                        hide: false,
                        open: function(event, ui) {
                            // ensure all other tooltips are closed
                            $(".ui-tooltip").not(ui.tooltip).remove();
                        },
                        content: function() {
                            var title = $(this).attr('title');
                            return window.convertTextToTableMagic(title);
                        }
                    });

    if(!window.tooltipClearerHasBeenSetup) {
        window.tooltipClearerHasBeenSetup = true;
        $(document).on('click', '.ui-tooltip', function() { $(this).remove(); });
    }
}

// BOOTING ///////////////////////////////////////////////////////////

function prepPluginsToLoad() {

    var priorities = {
        lowest: 100,
        low: 75,
        normal: 50,
        high: 25,
        highest: 0,
        boot: -100
    }

    function getPriority (data) {
        var v = data && data.priority || 'normal';
        var prio = priorities[v] || v;
        if (typeof prio !== 'number') {
            log.warn('wrong plugin priority specified: ', v);
            prio = priorities.normal;
        }
        return prio;
    }

    // executes setup function of plugin
    // and collects info for About IITC
    function safeSetup (setup) {
        if (!setup) {
            log.warn('plugin must provide setup function');
            return;
        }
        var info = setup.info;
        if (typeof info !== 'object' || typeof info.script !== 'object' || typeof info.script.name !== 'string') {
            log.warn('plugin does not have proper wrapper:',setup);
            info = { script: {} };
        }

        try {
            setup.call(this);
        } catch (err) {
            var name = info.script.name || '<unknown>';
            log.error('error starting plugin: ' + name + ', error: ' + err);
            info.error = err;
        }
        pluginsInfo.push(info);
    }

    if (window.bootPlugins) { // sort plugins by priority
        bootPlugins.sort(function (a,b) {
            return getPriority(a) - getPriority(b);
        });
    } else {
        window.bootPlugins = [];
    }

    var pluginsInfo = []; // for About IITC
    bootPlugins.info = pluginsInfo;

    // loader function returned
    // if called with parameter then load plugins with priorities up to specified
    return function (prio) {
        while (bootPlugins[0]) {
            if (prio && getPriority(bootPlugins[0]) > priorities[prio]) { break; }
            safeSetup(bootPlugins.shift());
        }
    };
}

function boot() {
    if(!isSmartphone()) // TODO remove completely?
        window.debug.console.overwriteNativeIfRequired();

    log.log('loading done, booting. Built: @@BUILDDATE@@');
    if (window.deviceID) {
        log.log('Your device ID: ' + window.deviceID);
    }
    window.runOnSmartphonesBeforeBoot();

    var loadPlugins = prepPluginsToLoad();
    loadPlugins('boot');

    window.extractFromStock();
    window.setupIdle();
    window.setupStyles();
    window.setupIcons();
    window.setupDialogs();
    window.setupDataTileParams();
    window.setupMap();
    //  window.setupOMS();
    window.search.setup();
    window.setupRedeem();
    window.setupLargeImagePreview();
    window.setupSidebarToggle();
    window.updateGameScore();
    //  window.artifact.setup();
    window.ornaments.setup();
    window.setupPlayerStat();
    window.setupTooltips();
    window.chat.setup();
    window.portalDetail.setup();
    window.setupLayerChooserStatusRecorder();
    // read here ONCE, so the URL is only evaluated one time after the
    // necessary data has been loaded.
    urlPortalLL = getURLParam('pll');
    if(urlPortalLL) {
        urlPortalLL = urlPortalLL.split(",");
        urlPortalLL = [parseFloat(urlPortalLL[0]) || 0.0, parseFloat(urlPortalLL[1]) || 0.0];
    }
    urlPortal = getURLParam('pguid');

    $('#sidebar').show();

    //  loadPlugins();

    var pos = window.getPosition();
    window.map.flyTo(pos.center, pos.zoom, pos.bearing, pos.pitch, {animation: false});

    //  window.runOnSmartphonesAfterBoot();

    window.iitcLoaded = true;
    window.runHooks('iitcLoaded');

    if (typeof android !== 'undefined' && android.bootFinished) {
        android.bootFinished();
    }
}

/*
OMS doesn't cancel the original click event, so the topmost marker will get a click event while spiderfying.
Also, OMS only supports a global callback for all managed markers. Therefore, we will use a custom event that gets fired
for each marker.
*/

window.setupOMS = function() {
    window.oms = new OverlappingMarkerSpiderfier(map, {
                                                     keepSpiderfied: true,
                                                     legWeight: 3.5,
                                                     legColors: {
                                                         usual: '#FFFF00',
                                                         highlighted: '#FF0000'
                                                     }
                                                 });

    window.oms.addListener('click', function(marker) {
        map.closePopup();
        marker.fireEvent('spiderfiedclick', {target: marker});
    });
    window.oms.addListener('spiderfy', function(markers) {
        map.closePopup();
    });
    //  map._container.addEventListener("keypress", function(ev) {
    //    if(ev.keyCode === 27) // Esc
    //      window.oms.unspiderfy();
    //  }, false);
}

window.registerMarkerForOMS = function(marker) {
    marker.on('add', function () {
        window.oms.addMarker(marker);
    });
    marker.on('remove', function () {
        window.oms.removeMarker(marker);
    });
    if(marker._map) // marker has already been added
        window.oms.addMarker(marker);
}

try {
@@INCLUDERAW:external/autolink-min.js@@
@@INCLUDERAW:external/turf.min.js@@

window.L_NO_TOUCH = navigator.maxTouchPoints===0; // prevent mobile style on desktop https://github.com/IITC-CE/ingress-intel-total-conversion/pull/189
@@INCLUDERAW:external/leaflet-src.js@@
@@INCLUDERAW:external/Leaflet.GoogleMutant.js@@
@@INCLUDERAW:external/mapbox-gl.js@@

@@INCLUDERAW:external/oms.min.js@@

@@INCLUDERAW:external/jquery-3.4.1.min.js@@
@@INCLUDERAW:external/jquery-ui-1.12.1.min.js@@
@@INCLUDERAW:external/taphold.js@@
@@INCLUDERAW:external/jquery.qrcode.min.js@@

} catch (e) {
    log.error("External's js loading failed");
    throw e;
}

$(boot);

