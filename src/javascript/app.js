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
                
                var store = Ext.create('Rally.data.wsapi.Store',{
                    model: 'Milestone',
                    fetch: ['FormattedID', 'Name', 'Artifacts', 'ObjectID','TargetDate']
                });
                
                this.down('#display_box').add({ 
                    xtype: 'tsroadmaptable',
                    store: store,
                    model: this.PortfolioItemType.get('TypePath')
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
        
        return this._loadWSAPIItems(config);
    },
    
    _loadWSAPIItems: function(config){
        var deferred = Ext.create('Deft.Deferred');
        var me = this;
        
        this.logger.log(config.model, "Loading with filters: ", Ext.clone(config.filters));
        
        var default_config = {
            fetch: ['ObjectID']
        };
        
        Ext.create('Rally.data.wsapi.Store', Ext.merge(default_config,config)).load({
            callback : function(records, operation, successful) {
                if (successful){
                    deferred.resolve(records);
                } else {
                    me.logger.log("Failed: ", operation);
                    deferred.reject('Problem loading: ' + operation.error.errors.join('. '));
                }
            }
        });
        return deferred.promise;
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
