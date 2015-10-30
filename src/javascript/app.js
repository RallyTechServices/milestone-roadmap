Ext.define("TSMilestoneRoadmapApp", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    defaults: { margin: 10 },
    items: [
        {xtype:'container',itemId:'display_box', minHeight: 500 }
    ],

    // TODO
    integrationHeaders : {
        name : "TSMilestoneRoadmapApp"
    },
                        
    launch: function() {
        var me = this;
        this.setLoading("Loading stuff...");
        
        this._getLowestPITypeName().then({
            scope  : this,
            success: function(types) {
                this.PortfolioItemType = types[0];
                this.logger.log('PI Type:', this.PortfolioItemType);
                
                var start_date = Rally.util.DateTime.add(new Date(), 'month', -1);
                
                this.down('#display_box').add({ 
                    xtype: 'tsroadmaptable',
                    startDate: start_date,
                    monthCount: 9,
                    cardModel: this.PortfolioItemType.get('TypePath')
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
    
    _getLowestPITypeName: function() {
        config = {
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
        // Ext.apply(this, settings);
        this.launch();
    }
});
