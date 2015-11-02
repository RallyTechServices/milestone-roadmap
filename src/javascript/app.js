Ext.define("TSMilestoneRoadmapApp", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    defaults: { margin: 10 },
    
    config: {
        defaultSettings: {
            colorStateMapping: {
                'defaultValue': 'Platinum',
                'Discovering': 'cyan'
            }
        }
    },
    
    items: [
        {xtype:'container', itemId:'selector_box', minHeight: 50},
        {xtype:'container', itemId: 'display_box'}
    ],
    // TODO
    integrationHeaders : {
        name : "TSMilestoneRoadmapApp"
    },
                        
    launch: function() {
        var me = this;
        this.setLoading("Loading milestones...");
        
        if ( this.down('tsroadmaptable') ) { this.down('tsroadmaptable').destroy(); }
        
        this._getLowestPIType().then({
            scope  : this,
            success: function(types) {
                this.setLoading('Loading items...');
                
                this.PortfolioItemType = types[0];
                this.logger.log('PI Type:', this.PortfolioItemType);
                
                var start_date = Rally.util.DateTime.add(new Date(), 'month', -1);
                var colors = this.getSetting('colorStateMapping');
                
                if ( Ext.isString(colors) ) { colors = Ext.JSON.decode(colors); }
                
                this.logger.log("Colors: ", colors);
                
                this.roadmap = this.down('#display_box').add({ 
                    xtype: 'tsroadmaptable',
                    startDate: start_date,
                    monthCount: 9,
                    stateColors: colors,
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
    
    _getCardboardConfig: function() {
        return {
            types: [this.PortfolioItemType.get('TypePath')],
            attribute: 'State',
            columnConfig: {
                xtype: 'tsmilestonecolumn'
            }
        };
    },
    
    _getLowestPIType: function() {
        var config = {
            model: 'TypeDefinition', 
            fetch: ["TypePath"],
            filters: [ { property:"Ordinal", operator:"=", value:0} ]
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
        
        return [
        {
            name: 'colorStateMapping',
            readyEvent: 'ready',
            fieldLabel: 'Colors by State',
            margin: '5px 0 0 30px',
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
