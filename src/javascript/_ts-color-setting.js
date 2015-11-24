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
            fields: ['state', 'groupName', 'colorStateMapping'],
            data: []
        });

        var gridWidth = Math.min(this.getWidth(true)-100, 500);

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
        var me = this;
        var columns = [
            {
                text: 'State',
                dataIndex: 'state',
                emptyCellText: 'None',
                flex: 1
            },
            {
                text: 'State Group',
                dataIndex: 'groupName',
                editor: {
                    xtype:'rallytextfield',
                    listeners: {
                        scope: me,
                        change: me._updateMyGroupColor
                    }
                }
            },
            {
                text: 'Color',
                dataIndex: 'colorStateMapping',
                editor: {
                    xtype: 'rallytextfield',
                    flex: 1,
                    listeners: {
                        scope: me,
                        change: me._updateOtherGroupColors
                    }
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

    _updateMyGroupColor: function(field, new_value, old_value, opts) {
        var grid = this._grid;
        var changed_records = grid.getSelectionModel().getSelection();
        var record_group_name = new_value;
        
        if ( !Ext.isEmpty(record_group_name) ) {
            grid.getStore().each(function(record) {
                var group = record.get('groupName');
                var color = record.get('colorStateMapping');
                
                if ( group == record_group_name && !Ext.isEmpty(color) ) {
                    changed_records[0].set('colorStateMapping', color);
                }
            });
        }
    },

    _updateOtherGroupColors: function(field, new_value, old_value, opts) {
        var grid = this._grid;
        var changed_records = grid.getSelectionModel().getSelection();
        var record_group_name = changed_records[0].get('groupName');;
        var record_color = new_value;
        var record_state = changed_records[0].get('state');
                
        if ( !Ext.isEmpty(record_group_name) ) {
            grid.getStore().each(function(record) {
                var group = record.get('groupName');
                var color = record.get('colorStateMapping');
                var state = record.get('state');
                
                if ( group == record_group_name && state != record_state ) {
                    record.set('colorStateMapping', record_color);
                }
            });
        }
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
            columns[record.get('state')] = {
                'colorStateMapping': record.get('colorStateMapping'),
                'groupName': record.get('groupName')
            };
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

    _getColumnValue: function(columnName) {
        var value = this._value;

        if ( Ext.isEmpty(value) ) {
            return null;
        }
        
        if ( Ext.isString(value) ) {
            value = Ext.JSON.decode(value);
        }
        
        if ( Ext.isString(value)[columnName] ) {
            return Ext.JSON.decode(value)[columnName];
        }

        return value[columnName];
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
            colorStateMapping: '',
            groupName: ''
        };
        
        if (pref) {
            if ( Ext.isString(pref) ) {
                column.colorStateMapping = pref;
            } else {
                column.colorStateMapping = pref.colorStateMapping;
                column.groupName = pref.groupName;
            }
        }

        return column;

    }
});
