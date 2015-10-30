/**
 * A grid that shows a roadmap.  Each row is a Rally project, each 
 * column is a month.  
 * 
 * The items that appear inside the cells has a milestone that falls into
 * the month and belongs to the project of the row.
 * 
 */
 
 Ext.define('Rally.technicalservices.RoadmapTable', {
    extend: 'Ext.Container',

    alias: 'widget.tsroadmaptable',

    /**
     * @property {String} cls The base class applied to this object's element
     */
    cls: "tsroadmap",

    config: {
        /**
         * @cfg {Rally.data.wsapi.Store} store (reqd)
         *
         * Store for the items that will show inside the grid
         */
        store: null,
        /**
         * 
         * @cfg {Rally.data.Model} (reqd)
         * The model of item to display 
         */
        model: null
    },

    /**
     * @constructor
     * @param {Object} config
     */
    constructor: function (config) {
        this.mergeConfig(config);
        
        this.callParent([this.config]);
    },

    initComponent: function () {
        if ( Ext.isEmpty(this.store) ) {
            console.error("Rally.technicalservices.RoadmapTable requires a milestone store");
            throw "Rally.technicalservices.RoadmapTable requires a milestone store";
        }
        this.callParent(arguments);
        
        var columns = this._getColumns();
        this._defineCustomModel(columns);
        
        var table_store = Ext.create('Rally.data.custom.Store',{ model: 'TSTableRow' });
        
        this.grid = this.add({ 
            xtype:'rallygrid', 
            store: table_store,
            columnCfgs: columns,
            showPagingToolbar : false,
            showRowActionsColumn : false
        });
        
        this.store.load({
            scope: this,
            callback : function(records, operation, successful) {
                if (successful){
                    this._updateRows(records, table_store);
                } else {
                    console.log('Problem loading: ' + operation.error.errors.join('. '));
                    Ext.Msg.alert('Problem loading milestones', operation.error.errors.join('. '));
                }
            }
        });
    },

    _defineCustomModel: function(columns) {
        var fields = Ext.Array.map(columns, function(column){
            var name = column.dataIndex;
            var type = 'object';
            if ( name == 'Project' ) { type = 'string'; }
            
            return { name: name, type: type };
        });
        
        Ext.define('TSTableRow', {
            extend: 'Ext.data.Model',
            fields: fields,
            
            addArtifact: function(artifact,milestone) {
                console.log("Adding artifact: ", artifact, milestone, this);
                var month = Ext.util.Format.date(milestone, 'F');
                if ( Ext.isEmpty(this.get(month)) ) {
                    this.set(month, [artifact]);
                } else {
                    var artifacts = this.get(month);
                    artifacts.push(artifact);
                    this.set(month, artifacts);
                }
            }
        });
    },
    
    _getColumns: function() {
        var columns = [{
            dataIndex: 'Project',
            text: '',
            flex: 1
        }];
        
        var month_stamp = Rally.util.DateTime.add(new Date(), 'month', -1);
        
        for ( var i=0; i<9; i++ ) {
            var month = Ext.util.Format.date(month_stamp, 'F');
            columns.push({
                dataIndex: month,
                text: month,
                flex: 1
            });
            
            month_stamp = Rally.util.DateTime.add(month_stamp, 'month', 1);
        }
        
        return columns;
    },
    
    _updateRows: function(milestones, table_store) {
        var me = this;
        
        var promises = [];
        
        Ext.Array.each(milestones, function(milestone){
            var collection_store = milestone.getCollection('Artifacts');
            promises.push( function() { return me._loadCollectionStore(collection_store,milestone.get('TargetDate')); } );
        });
        
        Deft.Chain.sequence(promises).then({
            scope: this,
            success: function(results) {
                var artifacts_by_milestone = {};
                Ext.Array.each(results, function(artifacts_by_a_milestone){
                    artifacts_by_milestone = Ext.apply(artifacts_by_milestone, artifacts_by_a_milestone);
                });
                
                var rows_by_project_oid = this._getRowsFromMilestoneHash(artifacts_by_milestone);
                
                Ext.Object.each( artifacts_by_milestone, function(milestone, artifacts) {
                    Ext.Array.each(artifacts, function(artifact){
                        var project_oid = artifact.get('Project').ObjectID;
                        rows_by_project_oid[project_oid].addArtifact(artifact,milestone);
                    });
                });
                table_store.loadRecords(Ext.Object.getValues(rows_by_project_oid));
            },
            failure: function(msg) {
                Ext.Msg.alert('Problem loading artifacts', msg);
            }
        });
    },
    
    _getRowsFromMilestoneHash: function(artifacts_by_milestone) {
        var rows_by_project_oid = {};
        
        Ext.Object.each( artifacts_by_milestone, function(milestone, artifacts){
            Ext.Array.each(artifacts, function(artifact) {
                var project_oid = artifact.get('Project').ObjectID;
                rows_by_project_oid[project_oid] = Ext.create('TSTableRow',{
                    Project: artifact.get('Project').Name
                });
            });
        });
        
        return rows_by_project_oid;
    },
    
    
    _loadCollectionStore: function(collection_store, milestone) {
        var deferred = Ext.create('Deft.Deferred');
        collection_store.load({
            fetch: ['FormattedID', 'Name', 'ObjectID','Project'],
            callback: function(artifacts, operation, successful) {
                if (successful){
                    var artifacts_by_milestone = {};
                    artifacts_by_milestone[milestone] = artifacts;
                    deferred.resolve(artifacts_by_milestone);
                } else {
                    deferred.reject('Problem loading: ' + operation.error.errors.join('. '));
                }
                
            }
        });
        return deferred;
    }
    

});
