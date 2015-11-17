Ext.define('TechnicalServices.ProjectSettingGroups',{
    extend: 'Ext.form.field.Base',
    alias: 'widget.projectgroupsettings',
    fieldSubTpl: '<div id="{id}" class="settings-grid"></div>',
    width: '100%',
    cls: 'column-settings',

    store: undefined,

    onDestroy: function() {
        if (this._grid) {
            this._grid.destroy();
            delete this._grid;
        }
        this.callParent(arguments);
    },
    
    initComponent: function(){

        this.callParent();
        this.addEvents('ready');

        this.setLoading('loading...');
        var store = Ext.create('Rally.data.wsapi.Store', {
            model: 'Project',
            fetch: ['Name'],
            //filters: [{property:'ObjectID', value: -1 }],
            context: {
                project: null
            },
            limit: 'Infinity'
        });
        store.load({
            scope: this,
            callback: this._buildProjectGrid
        });

    },

    onRender: function() {
        this.callParent(arguments);
        this.setLoading('Loading projects...');
    },
        
    _buildProjectGrid: function(records, operation, success){
        this.setLoading(false);
        var container = Ext.create('Ext.container.Container',{
            layout: { type:'hbox' },
            renderTo: this.inputEl,
            minHeight: 50,
            minWidth: 50
        });
        
        var decodedValue = {};
        
        
        if (this.initialConfig && this.initialConfig.value && !_.isEmpty(this.initialConfig.value)){
            if (!Ext.isObject(this.initialConfig.value)){
                decodedValue = Ext.JSON.decode(this.initialConfig.value);
            } else {
                decodedValue = this.initialConfig.value;
            }
        }
       
        

        var data = [],
            empty_text = "No selections";

        console.log('initial config', this._value, this.initialConfig, decodedValue);
            
        if (success && decodedValue !== {} ) {
            _.each(records, function(project){
                var setting = decodedValue[project.get('_ref')];
                var groupName = "";
                var groupOrder = "";
                if ( setting && setting !== {} ) {
                    groupName = setting.groupName;
                    groupOrder = setting.groupOrder;
                    if ( groupName || groupName == "" ) {
                        data.push({
                            projectRef: project.get('_ref'), 
                            projectName: project.get('Name'), 
                            groupName: groupName,
                            groupOrder: groupOrder
                        });
                    }
                }
            });
        } else {
            empty_text = "Error(s) fetching Project data: <br/>" + operation.error.errors.join('<br/>');
        }

        var custom_store = Ext.create('Ext.data.Store', {
            fields: ['projectRef', 'projectName', 'groupName','groupOrder'],
            data: data
        });
        
        var gridWidth = Math.min(this.inputEl.getWidth(true)-100, 400);
        this.inputEl.set
        this._grid = container.add(  {
            xtype:'rallygrid',
            autoWidth: true,
            columnCfgs: this._getColumnCfgs(),
            showPagingToolbar: false,
            store: custom_store,
            height: 150,
            width: gridWidth,
            emptyText: empty_text,
            editingConfig: {
                publishMessages: false
            }
        });

        var width = Math.min(this.inputEl.getWidth(true)-20, 400);
        
        //Ext.create('Rally.ui.Button',{
        container.add({
            xtype: 'rallybutton',
            text: 'Select Projects',
            margin: '0 0 0 10',
            listeners: {
                scope: this,
                click: function(){

                    Ext.create('ProjectPickerDialog',{
                        autoShow: true,
                        maxHeight: 300,
                        maxWidth: 400,
                        width: Math.min(width, 400),
                        title: 'Choose Project(s)',
                        selectedRefs: _.pluck(data, 'projectRef'),
                        listeners: {
                            scope: this,
                            itemschosen: function(items){
                                var new_data = [],
                                    store = this._grid.getStore();

                                _.each(items, function(item){
                                    if (!store.findRecord('projectRef',item.get('_ref'))){
                                        new_data.push({
                                            projectRef: item.get('_ref'),
                                            projectName: item.get('Name'),
                                            groupName: null,
                                            groupOrder: 0
                                        });
                                    }
                                });
                                this._grid.getStore().add(new_data);
                            }
                        }
                    });
                }
            }
        });

       this.fireEvent('ready', true);
    },
    _removeProject: function(){
        this.grid.getStore().remove(this.record);
    },
    _getColumnCfgs: function() {
        var me = this;

        var columns = [{
            xtype: 'rallyrowactioncolumn',
            scope: this,
            rowActionsFn: function(record){
                return  [
                    {text: 'Remove', record: record, handler: me._removeProject, grid: me._grid }
                ];
            },
            //Need to override this since we are using a custom store
            _renderGearIcon: function(value, metaData, record) {
                return '<div class="row-action-icon icon-gear"/>';
            }
        },
        {
            text: 'Project',
            dataIndex: 'projectRef',
            flex: 1,
            editor: false,
            renderer: function(v, m, r){
                return r.get('projectName');
            },
            getSortParam: function(v,m,r){
                return 'projectName';
            }
        },
        {
            text: 'Group Name',
            dataIndex: 'groupName',
            editor: {
                xtype: 'rallytextfield',
                listeners: {
                    scope: me,
                    change: this._updateGroupOrderWhenNameChanges
                }
            }
        },
        {
            text: 'Display Order',
            dataIndex: 'groupOrder',
            editor: {
                xtype: 'rallynumberfield',
                listeners: {
                    scope: me,
                    change: this._updateGroupOrders
                }
            }
        }];
        return columns;
    },
    
    _updateGroupOrderWhenNameChanges: function(field, new_value, old_value, opts) {
        var grid = this._grid;
        var changed_records = grid.getSelectionModel().getSelection();
        var record_group_name = new_value;
        
        if ( !Ext.isEmpty(record_group_name) ) {
            var group_order = -1;
            grid.getStore().each(function(record) {
                if ( record.get('groupName') == record_group_name && record.get('projectRef') != changed_records[0].get('projectRef')) {
                    changed_records[0].set('groupOrder', record.get('groupOrder'));
                }
            });
        }
    },
    
    _updateGroupOrders: function(field, new_value, old_value, opts) {
        var grid = this._grid;
        var changed_records = grid.getSelectionModel().getSelection();
        var record_group_name = changed_records[0].get('groupName');
        
        if ( !Ext.isEmpty(record_group_name) && Ext.isNumber(new_value) ) {
            grid.getStore().each(function(record) {
                if ( record.get('groupName') == record_group_name ) {
                    record.set('groupOrder', new_value);
                }
            });
        }
        // shift all the ones that were at the number up one level
        if ( Ext.isNumber(new_value) ) {
            
            // are there any that need to be shifted?
            if ( this._shouldShiftOrders(grid.getStore(), new_value, record_group_name) ) {

                grid.getStore().each(function(record) {
                    var record_order =  record.get('groupOrder');
                    
                    if ( record_order >= new_value && record.get('groupName') != record_group_name ) {
                        record.set('groupOrder', record_order + 1);
                    }
                });
            }
        }
    },
    
    _shouldShiftOrders: function(store, new_value, record_group_name) {
        var should_shift = false;
        store.each(function(record) {
            var group_name = record.get('groupName');
            if ( record.get('groupOrder') == new_value && group_name !== record_group_name && !Ext.isEmpty(group_name)) {
                should_shift = true;
            }
        });
        
        return should_shift;
    },
    /**
     * When a form asks for the data this field represents,
     * give it the name of this field and the ref of the selected project (or an empty string).
     * Used when persisting the value of this field.
     * @return {Object}
     */
    getSubmitData: function() {
        var data = {};
        data[this.name] = Ext.JSON.encode(this._buildSettingValue());
        return data;
    },
    
    _buildSettingValue: function() {
        var mappings = {};
        var store = this._grid.getStore();

        store.each(function(record) {
            if (record.get('projectRef')) {
                mappings[record.get('projectRef')] = {
                    'groupName': record.get('groupName') || "",
                    'groupOrder': record.get('groupOrder') || -1
                }
            }
        }, this);
        return mappings;
    },

    getErrors: function() {
        var errors = [];
        //Add validation here
        return errors;
    },
    setValue: function(value) {
        console.log('setValue', value);
        this.callParent(arguments);
        this._value = value;
    }
});