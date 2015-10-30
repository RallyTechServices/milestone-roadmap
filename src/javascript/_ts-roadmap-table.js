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
         * @cfg {date} startDate 
         *
         * Monthly columns start with this date (defaults to today)
         */
        startDate: new Date(),
        /**
         * 
         * @cfg {Number} monthCount
         * Number of columns to show
         * 
         */
        monthCount: 3,
        /**
         * 
         * @cfg {Rally.data.Model} (reqd)
         * The model of items to display 
         */
        cardModel: null
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
        if ( Ext.isEmpty(this.cardModel) ) {
            console.error("Rally.technicalservices.RoadmapTable requires a model name for the cards");
            throw "Rally.technicalservices.RoadmapTable requires a model name for the cards";
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
            showRowActionsColumn : false,
            sortableColumns: false
        });
        
        this._loadCards();
    },
    
    _loadCards: function() {
        this.card_store = Ext.create('Rally.data.wsapi.Store',{
            model: 'Milestone',
            filters: [
                {property:'TargetDate', operator: '>=', value: Rally.util.DateTime.add(this.startDate, 'month', -1)},
                {property:'TargetDate', operator: '<=', value: Rally.util.DateTime.add(this.startDate, 'month', this.monthCount+1)}
            ],
            fetch: ['FormattedID', 'Name', 'Artifacts', 'ObjectID','TargetDate']
        });
                
        this.card_store.load({
            scope: this,
            callback : function(records, operation, successful) {
                if (successful){
                    this._updateRows(records, this.grid.getStore());
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
                    this.set(month, [artifact.getData()]);
                } else {
                    var artifacts = this.get(month);
                    artifacts.push(artifact.getData());
                    this.set(month, artifacts);
                }
            }
        });
    },
    
    cardTemplate: new Ext.XTemplate(
        "<tpl for='.'>",
            "<div class='ts_card'>{Name}</div>",
        "</tpl>"
    ),

    
    getCellRenderer: function() {
        var me = this;
        return function(value, meta, record) {
           return me.cardTemplate.apply(value);
        }
    },
    
    _getColumns: function() {
        var columns = [{
            dataIndex: 'Project',
            text: '',
            flex: 1
        }];
        
        var month_stamp = Rally.util.DateTime.add(new Date(), 'month', -1);
        
        var card_renderer = this.getCellRenderer();
        
        for ( var i=0; i<9; i++ ) {
            var month = Ext.util.Format.date(month_stamp, 'F');
            columns.push({
                dataIndex: month,
                text: month,
                flex: 1,
                renderer: card_renderer,
                align: 'center'
            });
            
            month_stamp = Rally.util.DateTime.add(month_stamp, 'month', 1);
        }
        
        return columns;
    },
    
    _updateRows: function(milestones, table_store) {
        var me = this;
        var promises = [];
        
        Ext.Array.each(milestones, function(milestone){
            var oid = milestone.get('ObjectID');
            var target_date = milestone.get('TargetDate');
            
            promises.push( function() { return me._loadMilestoneItems(oid,target_date); } );
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
    
    
    _loadMilestoneItems: function(milestone_oid, milestone_date) {
        var deferred = Ext.create('Deft.Deferred');
        
        console.log("Loading ", this.cardModel, " with milestone date of ", milestone_date);
        
        var config = {
            model: this.cardModel,
            fetch: ['FormattedID', 'Name', 'ObjectID','Project'],
            filters: [{property:'Milestones.ObjectID', operator: 'contains', value: milestone_oid}]
        };
        
        TSUtilities.loadWSAPIItems(config).then({
            success: function(artifacts) {
                var artifacts_by_milestone = {};
                artifacts_by_milestone[milestone_date] = artifacts;
                deferred.resolve(artifacts_by_milestone);
            },
            failure: function(msg) {
                deferred.reject(msg);
            }
        });

        return deferred;
    }
    

});
