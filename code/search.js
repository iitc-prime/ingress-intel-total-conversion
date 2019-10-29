
// SEARCH /////////////////////////////////////////////////////////

/*
you can implement your own result provider by listing to the search hook:
addHook('search', function(query) {});

`query` is an object with the following members:
- `term` is the term for which the user has searched
- `confirmed` is a boolean indicating if the user has pressed enter after searching. You should not search online or
  do heavy processing unless the user has confirmed the search term
- `addResult(result)` can be called to add a result to the query.

`result` may have the following members (`title` is required, as well as one of `position` and `bounds`):
- `title`: the label for this result. Will be interpreted as HTML, so make sure to escape properly.
- `description`: secondary information for this result. Will be interpreted as HTML, so make sure to escape properly.
- `geojson`: a GeoJSON object describing the position of this result
- `layer`: a ILayer to be added to the map when the user selects this search result. Will be generated if not set.
  Set to `null` to prevent the result from being added to the map.
- `icon`: a URL to a icon to display in the result list. Should be 12x12.
- `onSelected(result, event)`: a handler to be called when the result is selected. May return `true` to prevent the map
  from being repositioned. You may reposition the map yourself or do other work.
- `onRemove(result)`: a handler to be called when the result is removed from the map (because another result has been
  selected or the search was cancelled by the user).
*/

window.search = {
    lastSearch: null,
};

window.search.Query = function(term, confirmed) {
    this.term = term;
    this.confirmed = confirmed;
    this.mapbox = undefined;
    this.init();
};

window.search.Query.prototype.init = function() {
    this.results = [];

    this.container = $('<div>').addClass('searchquery');

    this.header = $('<h3>')
    .text(this.confirmed
          ? this.term
          : ((this.term.length > 16
              ? this.term.substr(0,8) + '…' + this.term.substr(this.term.length-8,8)
              : this.term)
             + ' (Return to load more)'))
    .appendTo(this.container);

    this.list = $('<ul>')
    .appendTo(this.container)
    .append($('<li>').text(this.confirmed ? 'No local results, searching online...' : 'No local results.'));

    this.container.accordion({
                                 collapsible: true,
                                 heightStyle: 'content',
                             });

    runHooks('search', this);
};
window.search.Query.prototype.show = function() {
    this.container.appendTo('#searchwrapper');
};
window.search.Query.prototype.hide = function() {
    this.container.remove();
    this.removeSelectedResult();
};
window.search.Query.prototype.addResult = function(result) {
    if(this.results.length == 0) {
        // remove 'No results'
        this.list.empty();
    }

    this.results.push(result);
    var item = $('<li>')
    .appendTo(this.list)
    .attr('tabindex', '0')
    .on('click dblclick', function(ev) {
        this.onResultSelected(result, ev);
    }.bind(this))
    .keypress(function(ev) {
        if((ev.keyCode || ev.charCode || ev.which) == 32) {
            ev.preventDefault();
            ev.type = 'click';
            $(this).trigger(ev);
            return;
        }
        if((ev.keyCode || ev.charCode || ev.which) == 13) {
            ev.preventDefault();
            ev.type = 'dblclick';
            $(this).trigger(ev);
            return;
        }
    });

    var link = $('<a>')
    .append(result.title)
    .appendTo(item);

    if(result.icon) {
        link.css('background-image', 'url("'+result.icon+'")');
        item.css('list-style', 'none');
    }

    if(result.description) {
        item
        .append($('<br>'))
        .append($('<em>')
                .append(result.description));
    }

};

window.search.Query.prototype.onResultSelected = function(result, ev) {
    this.removeSelectedResult();
    this.selectedResult = result;

    if(result.onSelected) {
        if(result.onSelected(result, ev)) return;
    }

    if(ev.type === 'click') {
        switch (turf.getType(result.geojson)) {
        case 'Point':
            window.map.flyTo(result.geojson, Math.max(window.map.getZoom(), 17), window.map.getBearing(), window.map.getPitch());
            break;
        case 'Polygon':
            window.map.fitBounds(turf.bbox(result.geojson));
            break;
        }
    }

    if (window.search.Query.mapbox) {
        window.search.Query.mapbox.getSource('source-search').setData(result.geojson);
    }
}

window.search.Query.prototype.removeSelectedResult = function() {
    if(this.selectedResult) {
        if(this.selectedResult.layer) map.removeLayer(this.selectedResult.layer);
        if(this.selectedResult.onRemove) this.selectedResult.onRemove(this.selectedResult);
    }
}

window.search.doSearch = function(term, confirmed) {
    term = term.trim();

    // minimum 3 characters for automatic search
    if(term.length < 3 && !confirmed) return;

    // don't clear last confirmed search
    if(window.search.lastSearch
            && window.search.lastSearch.confirmed
            && !confirmed)
        return;

    // don't make the same query again
    if(window.search.lastSearch
            && window.search.lastSearch.confirmed == confirmed
            && window.search.lastSearch.term == term)
        return;

    if(window.search.lastSearch) window.search.lastSearch.hide();
    window.search.lastSearch = null;

    // clear results
    if(term == '') return;

    if(useAndroidPanes()) show('info');

    $('.ui-tooltip').remove();

    window.search.lastSearch = new window.search.Query(term, confirmed);
    window.search.lastSearch.show();
};

window.search.setup = function() {
    var self = this;
    $('#search')
    .keypress(function(e) {
        if((e.keyCode ? e.keyCode : e.which) != 13) return;
        e.preventDefault();

        var term = $(this).val();

        clearTimeout(window.search.timer);
        window.search.doSearch(term, true);
    })
    .on('keyup keypress change paste', function(e) {
        clearTimeout(window.search.timer);
        window.search.timer = setTimeout(function() {
            var term = $(this).val();
            window.search.doSearch(term, false);
        }.bind(this), 500);
    });
    $('#buttongeolocation').click(function(){
        map.locate({setView : true, maxZoom: 13});
    });
};


window.addHook('mapbox.map.loaded', function(data) {
    console.debug(data);
    window.search.Query.mapbox = data.map;
    data.map.addSource('source-search', {
                             "type": "geojson",
                             "data": turf.featureCollection([])
                         });
    data.map.addLayer({
                            'id': 'layer-search-point',
                            'source': 'source-search',
                            'type': 'symbol',
                            "filter": [
                                "==",
                                "$type",
                                "Point"
                            ],
                            'layout': {
                                "icon-image": 'embassy-15',
                              "icon-size": 3,
                              "icon-anchor": 'bottom',
                              "icon-offset": [5, 3]
                            }
                        });
    data.map.addLayer({
                            'id': 'layer-search-polygon',
                            'source': 'source-search',
                            'type': 'line',
                            "filter": [
                                "==",
                                "$type",
                                "Polygon"
                            ],
                          'layout': {
                              'line-join': 'round'
                          },
                            'paint': {
                                "line-color": 'red',
                                'line-opacity': 0.5,
                              "line-width": 3
                            }
                        });
});

// search for portals
addHook('search', function(query) {
    var term = query.term.toLowerCase();
    var teams = ['NEU','RES','ENL'];

    $.each(portals, function(guid, portal) {
        var data = portal.properties.data;
        if(!data.title) return;

        if(data.title.toLowerCase().indexOf(term) !== -1) {
            var team = portal.properties.team;
            var color = team==TEAM_NONE ? '#CCC' : COLORS[team];
            query.addResult({
                                title: data.title,
                                description: teams[team] + ', L' + data.level + ', ' + data.health + '%, ' + data.resCount + ' Resonators',
                                geojson: portal,
                                icon: 'data:image/svg+xml;base64,'+btoa('@@INCLUDESTRING:images/icon-portal.svg@@'.replace(/%COLOR%/g, color)),
                            });
        }
    });
});


// search for locations
// TODO: recognize 50°31'03.8"N 7°59'05.3"E and similar formats
addHook('search', function(query) {
    var locations = query.term.match(/[+-]?\d+\.\d+,[+-]?\d+\.\d+/g);
    var added = {};
    if(!locations) return;
    locations.forEach(function(location) {
        var pair = location.split(',').map(function(s) { return parseFloat(s).toFixed(6); });
        console.debug(pair);
        var ll = pair.join(",");
        if(added[ll]) return;
        added[ll] = true;

        query.addResult({
                            title: ll,
                            description: 'geo coordinates',
                            geojson: turf.point([parseFloat(pair[1]), parseFloat(pair[0])]),
                        });
    });
});


// search on OpenStreetMap
addHook('search', function(query) {
    if(!query.confirmed) return;

    // Viewbox search orders results so they're closer to the viewbox
    var mapBounds = window.map.getBounds();
    var viewbox = '&viewbox=' + mapBounds.join(',');

    var resultCount = 0;
    var resultMap = {};
    function onQueryResult(isViewboxResult, data) {
        resultCount += data.length;
        if(isViewboxResult) {
            // Search for things outside the viewbox
            $.getJSON(NOMINATIM + encodeURIComponent(query.term) + viewbox, onQueryResult.bind(null, false));
            if(resultCount === 0) { return; }
        } else {
            if(resultCount === 0) {
                query.addResult({
                                    title: 'No results on OpenStreetMap',
                                    icon: '//www.openstreetmap.org/favicon.ico',
                                });
                return;
            }
        }

        data.forEach(function(item) {
            if(resultMap[item.place_id]) { return; } // duplicate
            resultMap[item.place_id] = true;

            var result = {
                title: item.display_name,
                description: 'Type: ' + item.type,
                geojson: turf.point([parseFloat(item.lon), parseFloat(item.lat)]),
                icon: item.icon,
            };

            if(item.geojson) {
                result.geojson = { type: 'Feature', geometry: item.geojson };
            }

            if(item.boundingbox) {
                //        result.geojson = turf.bbox(turf.lineString([[b[2], b[0]], [b[3], b[1]]]));
            }

            query.addResult(result);
        });
    }

    // Bounded search allows amenity-only searches (e.g. "amenity=toilet") via special phrases
    // http://wiki.openstreetmap.org/wiki/Nominatim/Special_Phrases/EN
    var bounded = '&bounded=1';

    $.getJSON(NOMINATIM + encodeURIComponent(query.term) + viewbox + bounded, onQueryResult.bind(null, true));
});

