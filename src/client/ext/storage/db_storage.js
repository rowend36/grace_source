define(function (require, exports, module) {
    var Utils = require('grace/core/utils').Utils;
    var Store = require('grace/core/store').Store;
    var ITEM = ':';
    var BAD_ID = 'Invalid ID';
    var JOIN = ',';
    var KEY = ':';
    var debug = console;

    function DBStorage(id) {
        id = id.toLowerCase();
        Utils.assert(id.indexOf(KEY) < 0, BAD_ID + ' ' + id);
        Utils.assert(id.indexOf(JOIN) < 0, BAD_ID + ' ' + id);
        this._id = id;
        this._store = new Store(this._id + ITEM, []);
        this._store.onChange = this.handleChange.bind(this);
    }
    DBStorage.prototype.handleChange = function (old, newVal) {
        //The default store behaviour is to always ensure deleted items are not in use.
        var removed = this.itemList.filter(Utils.notIn(newVal));
        if (removed.length) this.set(removed.concat(newVal));
    };
    DBStorage.prototype.load = function (
        onLoadItem,
        onLostItem,
        onNoItem,
        onFinish
    ) {
        this.itemList = [];
        this._changes = {};
        this.$stores = {};
        var items = this._store.get();
        for (var i = 0; i < items.length; i++) {
            var id = items[i];
            var store = new Store(this._id + ITEM + id);
            if (store.get()) {
                this.$stores[id] = store;
                this.itemList.push(id);
                onLoadItem && onLoadItem(id, store.get());
            } else {
                store.destroy();
                onLostItem && onLostItem(id);
            }
        }
        if (this.itemList.length == 0) {
            onNoItem && onNoItem();
        }
        onFinish && onFinish();
    };
    DBStorage.prototype._persist = function () {
        if (this._needsPersist) return;
        this._store.set(this.itemList);
    };

    DBStorage.prototype.beginBatch = function () {
        this._inBatch++;
    };

    DBStorage.prototype.withinBatch = function (func, ctx) {
        this.beginBatch();
        try {
            func.apply(ctx);
        } finally {
            this.endBatch();
            //cancel??
        }
    };
    DBStorage.prototype.endBatch = function () {
        this._inBatch--;
        if (this._inBatch) return;
        for (var i in this._changes) {
            if (this._changes[i] !== undefined)
                this.$setItem(i, this._changes[i]);
            else this.removeItem(i);
        }
        if (this._needsPersist) {
            this._needsPersist = false; //order matters
            this._persist();
        }
        this._changes = {};
    };
    DBStorage.prototype.getItem = function (id) {
        return this._changes.hasOwnProperty(id)
            ? this._changes[id]
            : this.$stores[id]
            ? this.$stores[id].get()
            : undefined;
    };
    DBStorage.prototype.hasItem = function (id) {
        return this.itemList.indexOf(id) > -1;
    };
    DBStorage.prototype.$setItem = function (id, data) {
        Utils.assert(
            this.itemList.indexOf(id) > -1,
            'Saving item that does not exist'
        );
        if (this._inBatch) this._changes[id] = data;
        else {
            try {
                this.$stores[id].set(data);
            } catch (e) {
                debug.error('Exception while saving:' + e);
            }
        }
    };
    DBStorage.prototype.setItem = function (id, data, create) {
        if (this.itemList.indexOf(id) > -1) {
            Utils.assert(data !== undefined, 'Cannot set to undefined');
            this.$setItem(id, data);
        } else if (!create) {
            throw new Error('Item does not exist');
        } else this.createItem(id, data);
    };
    DBStorage.prototype.removeItem = function (id) {
        Utils.assert(
            this.itemList.indexOf(id) > -1,
            'Removing item that does not exist'
        );
        this.itemList.splice(this.itemList.indexOf(id), 1);

        if (this._inBatch) {
            this._changes[id] = undefined;
            this._needsPersist = true;
        } else {
            this.$stores[id].destroy();
            delete this.$stores[id];
            this._persist();
        }
    };
    DBStorage.prototype.createItem = function (id, data) {
        Utils.assert(this.itemList.indexOf(id) < 0, 'Key already exists ' + id);
        Utils.assert(id.indexOf(KEY) < 0, BAD_ID + ' ' + id);
        Utils.assert(id.indexOf(JOIN) < 0, BAD_ID + ' ' + id);
        this.itemList.push(id);
        this.$stores[id] = new Store(this._id + ITEM + id);
        if (this._inBatch) {
            this._needsPersist = true;
        } else this._persist();
        if (data != undefined) {
            this.$setItem(id, data);
        }
    };
    exports.DBStorage = DBStorage;
}); /*_EndDefine*/