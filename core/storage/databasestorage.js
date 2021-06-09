_Define(function(global) {
    var Utils = global.Utils;
    var appStorage = global.appStorage;
    var storages = {};
    var ITEM_LIST = ":L:";
    var ITEM = ":I:";
    var BAD_ID = "Invalid ID";
    var JOIN = ",";
    var KEY = ":";
    //truncate the length of a long id

    function half(id) {
        if (id.length < 6) return id;

        //do a crude hash
        var sum = 33900;
        for (var i = 0; i < id.length; i++) {
            var char = id.charCodeAt(i);
            sum += char * (i + 1);
        }
        sum = (sum % 67 + sum % 23 + sum % 11 + sum % 2);

        //put a bit of resemblance
        var _id = id.substring(0, 3) + JOIN + sum;

        return _id;
    }

    function Storage(id) {
        id = id.toLowerCase();
        Utils.assert(id.indexOf(KEY) < 0, BAD_ID + " " + id);
        Utils.assert(id.indexOf(JOIN) < 0, BAD_ID + " " + id);
        this._id = half(id);
        //Bad coding
        Utils.assert(!storages[this._id], storages[this._id] == id ? "ID already exists" :
            "Internal error: ID Conflict, contact plugin maintainer");
        storages[this._id] = id;
    }
    Storage.prototype.load = function(onLoadItem, onNoItem, onLostItem) {
        this.changedItems = {};
        this.itemList = [];
        this.items = {};
        var items = appStorage.getItem(this._id + ITEM_LIST);
        if (items) {
            items = items.split(JOIN);
            for (var i = 0; i < items.length; i++) {
                var id = items[i];
                var state = appStorage.getItem(this._id + ITEM + id);
                if (state) {
                    this.itemList.push(id);
                    var data = this.itemAdapter.parse(state);
                    this.setItem(id, data);
                    onLoadItem && onLoadItem(id, data);
                } else {
                    onLostItem && onLostItem(id);
                }
            }
        } else {
            onNoItem && onNoItem();
        }
    };
    Storage.prototype.persist = function() {
        if (this._inTransaction === false) return;
        appStorage.setItem(this._id + ITEM_LIST, this.itemList.join(JOIN));
    };

    Storage.prototype.beginTransaction = function() {
        this._inTransaction = true;
    };

    Storage.prototype.withinTransaction = function(func, ctx) {
        var before = this._inTransaction;
        this._inTransaction = true;
        try {
            func.apply(ctx);
        } catch (Exception) {
          //cancel??
        }
        this._inTransaction = before;
        if (before) return;
        this.endTransaction();
    };
    Storage.prototype.endTransaction = function() {
        this._inTransaction = false;
        for (var i in this.changedItems) {
            if (this.changedItems[i])
                this.saveItem(i);
            else {
                this.needsPersist = true;
                this.removeItem(i);
            }
        }
        delete this.inTransaction;
        if (this.needsPersist) {
            this.persist();
            this.needsPersist = false;
        }
        this.changedItems = {};
    };

    Storage.prototype.saveItem = function(id) {
        Utils.assert(this.itemList.indexOf(id) > -1, "Saving item that does not exist");
        if (this._inTransaction) this.changedItems[id] = true;
        else {
            try {
                appStorage.setItem(this._id + ITEM + id, this.itemAdapter.stringify(this
                    .getItem(id)));
            } catch (e) {
                console.error('Exception while saving:' + e);
            }
        }
    };
    Storage.prototype.itemAdapter = JSON;

    Storage.prototype.getItem = function(id) {
        return this.items[id];
    };
    Storage.prototype.setItem = function(id, data) {
        this.items[id] = data;
    };
    Storage.prototype.removeItem = function(id) {
        Utils.assert(this.itemList.indexOf(id) > -1,
            "Removing item that does not exist");
        this.itemList.splice(this.itemList.indexOf(id), 1);

        if (this._inTransaction) {
            this.changedItems[id] = false;
        } else {
            this.persist();
            appStorage.removeItem(this._id + ITEM + id);
        }
    };
    Storage.prototype.createItem = function(id, data) {
        Utils.assert(this.itemList.indexOf(id) < 0, "Key already exists " + id);
        Utils.assert(id.indexOf(KEY) < 0, BAD_ID + " " + id);
        Utils.assert(id.indexOf(JOIN) < 0, BAD_ID + " " + id);
        this.itemList.push(id);
        if (this._inTransaction) {
            this.needsPersist = true;
        } else this.persist();
        if (data) {
            this.setItem(id, data);
            this.saveItem(id);
        }
    };
    global.DBStorage = Storage;
}); /*_EndDefine*/