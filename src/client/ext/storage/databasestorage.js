define(function (require, exports, module) {
    var Utils = require("grace/core/utils").Utils;
    var storage = require("grace/core/config").storage;
    var SharedStore = require("grace/ext/storage/shared_store").SharedStore;
    var storages = {};
    var ITEM = ":";
    var BAD_ID = "Invalid ID";
    var JOIN = ",";
    var KEY = ":";
    var debug = console;
    //truncate the length of a long id

    function half(id) {
        if (id.length < 6) return id;

        //do a crude hash
        var sum = 33900;
        for (var i = 0; i < id.length; i++) {
            var char = id.charCodeAt(i);
            sum += char * (i + 1);
        }
        sum = (sum % 67) + (sum % 23) + (sum % 11) + (sum % 2);

        //put a bit of resemblance
        var _id = id.substring(0, 3) + sum;

        return _id;
    }

    function DBStorage(id) {
        id = id.toLowerCase();
        Utils.assert(id.indexOf(KEY) < 0, BAD_ID + " " + id);
        Utils.assert(id.indexOf(JOIN) < 0, BAD_ID + " " + id);
        this._id = half(id);
        Utils.assert(
            !storages[this._id],
            storages[this._id] == id
                ? "ID already exists"
                : "Internal error: ID Conflict, contact plugin maintainer"
        );
        this._store = new SharedStore(this._id + ITEM);
        //stop changes to this item from corrupting it
        this._store.transport.connect();
        //Bad coding
        storages[this._id] = id;
    }
    DBStorage.prototype.load = function (
        onLoadItem,
        onLostItem,
        onNoItem,
        onFinish
    ) {
        this.changedItems = {};
        this.itemList = [];
        this.items = {};
        var items = this._store.get();
        if (items) {
            for (var i = 0; i < items.length; i++) {
                var id = items[i];
                var state = storage.getItem(this._id + ITEM + id);
                if (state) {
                    this.itemList.push(id);
                    var data = this.itemAdapter.parse(state);
                    this.$setItem(id, data);
                    onLoadItem && onLoadItem(id, data);
                } else {
                    onLostItem && onLostItem(id);
                }
            }
        } else {
            onNoItem && onNoItem();
        }
        onFinish && onFinish();
    };
    DBStorage.prototype.persist = function () {
        if (this._inBatch === false) return;
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
        for (var i in this.changedItems) {
            if (this.changedItems[i]) this.saveItem(i);
            else {
                this.needsPersist = true;
                this.removeItem(i);
            }
        }
        delete this.inBatch;
        if (this.needsPersist) {
            this.persist();
            this.needsPersist = false;
        }
        this.changedItems = {};
    };

    DBStorage.prototype.saveItem = function (id) {
        Utils.assert(
            this.itemList.indexOf(id) > -1,
            "Saving item that does not exist"
        );
        if (this._inBatch) this.changedItems[id] = true;
        else {
            try {
                storage.setItem(
                    this._id + ITEM + id,
                    this.itemAdapter.stringify(this.getItem(id))
                );
            } catch (e) {
                debug.error("Exception while saving:" + e);
            }
        }
    };
    DBStorage.prototype.itemAdapter = JSON;

    DBStorage.prototype.getItem = function (id) {
        return this.items[id];
    };
    DBStorage.prototype.$setItem = function (id, data) {
        this.items[id] = data;
    };
    DBStorage.prototype.setItem = function (id, data, noNew) {
        if (this.itemList.indexOf(id) > -1) {
            this.$setItem(id, data);
            this.saveItem(id);
        } else if (noNew) {
            throw new Error("Item does not exist");
        } else this.createItem(id, data);
    };
    DBStorage.prototype.removeItem = function (id) {
        Utils.assert(
            this.itemList.indexOf(id) > -1,
            "Removing item that does not exist"
        );
        this.itemList.splice(this.itemList.indexOf(id), 1);

        if (this._inBatch) {
            this.changedItems[id] = false;
        } else {
            this.persist();
            storage.removeItem(this._id + ITEM + id);
        }
    };
    DBStorage.prototype.createItem = function (id, data) {
        Utils.assert(this.itemList.indexOf(id) < 0, "Key already exists " + id);
        Utils.assert(id.indexOf(KEY) < 0, BAD_ID + " " + id);
        Utils.assert(id.indexOf(JOIN) < 0, BAD_ID + " " + id);
        this.itemList.push(id);
        if (this._inBatch) {
            this.needsPersist = true;
        } else this.persist();
        if (data != undefined) {
            this.$setItem(id, data);
            this.saveItem(id);
        }
    };
    exports.DBStorage = DBStorage;
}); /*_EndDefine*/