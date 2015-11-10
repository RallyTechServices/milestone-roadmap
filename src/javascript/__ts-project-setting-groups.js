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
            empty_text = "No exceptions";

        if (success) {
            _.each(records, function(project){
                var groupName = decodedValue[project.get('_ref')];
                if ( groupName || groupName == "" ) {
                    data.push({projectRef: project.get('_ref'), projectName: project.get('Name'), groupName: groupName});
                }
            });
        } else {
            empty_text = "Error(s) fetching Project data: <br/>" + operation.error.errors.join('<br/>');
        }

        var custom_store = Ext.create('Ext.data.Store', {
            fields: ['projectRef', 'projectName', 'groupName'],
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
                                            groupName: null
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
        },{
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
        },{
            text: 'Group Name',
            dataIndex: 'groupName',
            editor: {
                xtype: 'rallytextfield'
            }
        }];
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
        data[this.name] = Ext.JSON.encode(this._buildSettingValue());
        return data;
    },
    _buildSettingValue: function() {
        var mappings = {};
        var store = this._grid.getStore();

        store.each(function(record) {
            if (record.get('projectRef')) {
                mappings[record.get('projectRef')] = record.get('groupName') || "";
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
        this.callParent(arguments);
        this._value = value;
    }
});