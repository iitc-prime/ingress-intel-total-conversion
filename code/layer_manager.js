window.LayerManager = function() {
    this.layers = [];
    this.visible = {};
    var self = this;
    window.addHook("setLayerVisible", function(layer) {
        self.setVisible(layer.id, layer.visible);
    });
}

window.LayerManager.prototype.addLayer = function(id, name, visible = true) {
    var layer = {id: id, name: name};
    this.visible[id] = visible;
    this.layers.push(layer);
    runHooks('layerAdded', layer);
}

window.LayerManager.prototype.isVisible = function(id) {
    return this.visible[id];
}

window.LayerManager.prototype.setVisible = function(id, visible) {
    if (this.visible[id] === visible) return;
    this.visible[id] = visible;
    runHooks('layerVisibleChanged', {id: id, visible: visible});
}
