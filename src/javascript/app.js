Ext.define("TSMilestoneRoadmapApp", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    defaults: { margin: 10 },
    
    settingsScope: 'project',

    config: {
        defaultSettings: {
            colorStateMapping: {
               // 'Discovering':  { 'colorStateMapping': 'Platinum', 'groupName': 'test' }
            },
            projectGroupsWithOrder: {}
        }
    },
    
    layout: { type: 'border' },
    
    items: [
        {xtype:'container', region: 'north', itemId:'selector_box', minHeight: 25},
        {xtype:'container', region: 'center', itemId:'display_box', layout: 'fit'},
        {xtype:'container', region: 'south', itemId:'legend_box', layout: 'hbox'}
    ],
    // TODO
    integrationHeaders : {
        name : "TSMilestoneRoadmapApp"
    },
                        
    launch: function() {
        var me = this;
        this.setLoading("Loading milestones...");
        
        if ( this.down('tsroadmaptable') ) { this.down('tsroadmaptable').destroy(); }
        
        var colors = this.getSetting('colorStateMapping');
        var project_groups = this.getSetting('projectGroupsWithOrder');
        
        if ( Ext.isString(colors) ) { colors = Ext.JSON.decode(colors); }
        if ( Ext.isString(project_groups) ) { project_groups = Ext.JSON.decode(project_groups); }
        this.logger.log("Colors: ", colors);
        this.logger.log("Project Groups: ", project_groups);
                
                
        this._addLegend(this.down('#legend_box'), colors);
        
        this._getAppropriatePIType().then({
            scope  : this,
            success: function(types) {
                this.setLoading('Loading items...');
                
                this.PortfolioItemType = types[0];
                this.logger.log('PI Type:', this.PortfolioItemType);
                
                var start_date = Rally.util.DateTime.add(new Date(), 'month', -1);
                
                this.roadmap = this.down('#display_box').add({ 
                    xtype: 'tsroadmaptable',
                    startDate: start_date,
                    monthCount: 9,
                    stateColors: colors,
                    projectGroups: project_groups,
                    cardModel: this.PortfolioItemType.get('TypePath'),
                    listeners: {
                        gridReady: function() {
                            me.setLoading(false);
                        }
                    }
                });
                
                
            },
            failure: function(msg) {
                Ext.Msg.alert('Problem loading PI Type Names', msg);
            }
        });
    },
    
    _addLegend: function(container,colors) {
        container.removeAll();
        container.add({ xtype:'container', itemID: 'spacer', flex: 1});
        
        console.log('legend', colors);
        var colors_by_group = {};
        Ext.Object.each(colors, function(state_name, color_object){
            var key = color_object.groupName;
            if ( Ext.isEmpty(key) ) {
                key = state_name;
            }
            var color = color_object.colorStateMapping;
            if ( !Ext.isEmpty(color) ) {
                colors_by_group[key] = color;
            }
        });
        
        Ext.Object.each(colors_by_group, function(name, color){
            container.add({
                xtype:'container',
                layout: 'hbox',
                items: [
                    {xtype:'container', cls: 'legend-box', style: "backgroundColor:" + color + ";",  padding: 5, margin: 5},
                    {xtype:'container', html: name, margin:3 }
                ]
            });
        });
        
    },
    
    _getCardboardConfig: function() {
        return {
            types: [this.PortfolioItemType.get('TypePath')],
            attribute: 'State',
            columnConfig: {
                xtype: 'tsmilestonecolumn'
            }
        };
    },
    
    _getAppropriatePIType: function() {
        var config = {
            model: 'TypeDefinition', 
            fetch: ["TypePath"],
            filters: [ { property:"Ordinal", operator:"=", value:1} ]
        };
        
        return TSUtilities.loadWSAPIItems(config);
    },
    
    _displayGrid: function(store,field_names){
        this.down('#display_box').add({
            xtype: 'rallygrid',
            store: store,
            columnCfgs: field_names
        });
    },
    
    getOptions: function() {
        return [
            {
                text: 'About...',
                handler: this._launchInfo,
                scope: this
            }
        ];
    },
    
    _launchInfo: function() {
        if ( this.about_dialog ) { this.about_dialog.destroy(); }
        this.about_dialog = Ext.create('Rally.technicalservices.InfoLink',{});
    },
    
    isExternal: function(){
        return typeof(this.getAppId()) == 'undefined';
    },
    
    //onSettingsUpdate:  Override
    onSettingsUpdate: function (settings){
        this.logger.log('onSettingsUpdate',settings);
        
        //Ext.apply(this, settings);
        this.launch();
    },
    
    getSettingsFields: function() {
        var me = this;
        var config = this.getSettings();
        var current_project_groups = (config && config.projectGroupsWithOrder) || {};
        
        return [{
            xtype: 'projectgroupsettings',
            name: 'projectGroupsWithOrder',
            fieldLabel: 'Projects to display (optionally make groups)',
            labelAlign: 'left',
            margin: 0,
            value: current_project_groups,
            readyEvent: 'ready'
        },
        {
            name: 'colorStateMapping',
            readyEvent: 'ready',
            fieldLabel: 'Colors by State',
            width: this.getWidth() -10,
            margin: 0,
            height: 200,
            xtype: 'colorsettingsfield',
            handlesEvents: {
                fieldselected: function(field) {
                    this.refreshWithNewField(field);
                }
            },
            listeners: {
                ready: function() {
                    this.fireEvent('colorsettingsready');
                }
            },
            bubbleEvents: 'colorsettingsready'
        }];
    }
});
