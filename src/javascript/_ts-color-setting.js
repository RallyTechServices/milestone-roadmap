/**
 *
 */
Ext.define('Rally.techservices.ColorSettingsField', {
    extend: 'Ext.form.field.Base',
    alias: 'widget.colorsettingsfield',
    plugins: ['rallyfieldvalidationui'],

    fieldSubTpl: '<div id="{id}" class="settings-grid"></div>',

    cls: 'column-settings',

    config: {
        /**
         * @cfg {Object}
         *
         * The column settings value for this field
         */
        value: undefined
    },

    onDestroy: function() {
        if (this._grid) {
            this._grid.destroy();
            delete this._grid;
        }
        this.callParent(arguments);
    },

    onRender: function() {
        this.callParent(arguments);

        this._store = Ext.create('Ext.data.Store', {
            fields: ['state', 'colorStateMapping'],
            data: []
        });

        var gridWidth = Math.min(this.getWidth(true)-100, 400);

        this._grid = Ext.create('Rally.ui.grid.Grid', {
            maxWidth: gridWidth,
            height: 150,
            renderTo: this.inputEl,
            columnCfgs: this._getColumnCfgs(),
            showPagingToolbar: false,
            showRowActionsColumn: false,
            enableRanking: false,
            store: this._store,
            editingConfig: {
                publishMessages: false
            }
        });
        
        this._getStateField();
    },
    
    _getStateField: function() {
        var me = this;
        config = {
            model: 'TypeDefinition', 
            fetch: ["TypePath"],
            filters: [ { property:"Ordinal", operator:"=", value:1} ]
        };
        
        TSUtilities.loadWSAPIItems(config).then({
            scope: this,
            success: function(types) {
                var type = types[0];
                var type_path = type.get('TypePath');
                
                Rally.data.ModelFactory.getModel({
                    type: type_path,
                    success: function(model) {
                        var field = model.getField('State');
                        me.refreshWithNewField(field);
                    }
                });

            },
            failure: function(msg) {
                alert("Problem loading PI type: " + msg);
            }
        });
    },

    _getColumnCfgs: function() {
        var columns = [
            {
                text: 'State',
                dataIndex: 'state',
                emptyCellText: 'None',
                flex: 1
            },
            {
                text: 'Color',
                dataIndex: 'colorStateMapping',
                editor: {
                    xtype: 'rallytextfield',
                    flex: 1
//                    validator: function (value) {
//                        return (value === '' || (value > 0 && value <= 9999)) || 'WIP must be > 0 and < 9999.';
//                    },
//                    rawToValue: function (value) {
//                        return value === '' ? value : parseInt(value, 10);
//                    }
                }
            }
        ];

        return columns;
    },

    /**
     * When a form asks for the data this field represents,
     * give it the name of this field and the ref of the selected project (or an empty string).
     * Used when persisting the value of this field.
     * @return {Object}
     */
    getSubmitData: function() {
        var data = {};
        data[this.name] = Ext.JSON.encode( this._buildSettingValue() );
        return data;
    },

    _buildSettingValue: function() {
        var columns = {};
        this._store.each(function(record) {
            columns[record.get('state')] = record.get('colorStateMapping');
        }, this);
        return columns;
    },

    getErrors: function() {
        var errors = [];
        if (this._storeLoaded && !Ext.Object.getSize(this._buildSettingValue())) {
            errors.push('At least one column must be shown.');
        }
        return errors;
    },

    setValue: function(value) {
        this.callParent(arguments);
        this._value = value;
    },

    _getColumnValue: function(stateName) {
        var value = this._value;

        if ( Ext.isEmpty(value) ) {
            return null;
        }
        
        if ( Ext.isString(value) ) {
            value = Ext.JSON.decode(value);
        }
        
        if ( Ext.isString(value)[stateName] ) {
            return Ext.JSON.decode(value)[stateName];
        }

        return value[stateName];
    },

    refreshWithNewField: function(field) {
        delete this._storeLoaded;
        field.getAllowedValueStore().load({
            callback: function(records, operation, success) {
                var data = Ext.Array.map(records, this._recordToGridRow, this);
                
                this._store.loadRawData(data);
                this.fireEvent('ready');
                this._storeLoaded = true;
            },
            scope: this
        });
    },

    _recordToGridRow: function(allowedValue) {
        var stateName = allowedValue.get('StringValue');
        var pref = this._store.getCount() === 0 ? this._getColumnValue(stateName) : null;

        var column = { 
            state: stateName,
            colorStateMapping: ''
        };
        
        if (pref) {
            column.colorStateMapping = pref;
        }

        return column;

    }
});
