Ext.define('TSUtilities',{
    singleton: true,
    logger: new Rally.technicalservices.Logger(),

    loadWSAPIItems: function(config){
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
    }
});