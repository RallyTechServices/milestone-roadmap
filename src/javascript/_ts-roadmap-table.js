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
        cardModel: null,
        /**
         * 
         * @cfg {object} 
         *     { state1: 'Platinum', state2: 'blue', default: 'Platinum' } 
         */
        stateColors: {
            'defaultValue': { 'colorStateMapping': 'cyan', 'groupName': 'none' }
        },
        /**
         * 
         * @cfg {object}
         *    { project_ref1: { 'groupName': 'A', 'groupOrder': 1 },
         *      project_ref2: { 'groupName': 'B', 'groupOrder': 2 },
         *      project_ref3: { 'groupName': 'A', 'groupOrder': 1 },
         *      ...
         *    } 
         */
        projectGroups: {},
        
        layout: 'fit'
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
        
        this.addEvents(
            /**
             * @event
             * Fires when the grid has been rendered
             * @param {Rally.technicalservices.RoadmapTable} this
             * @param {Rally.ui.grid.Grid} grid
             */
            'gridReady'
        );
        var columns = this._getColumns();
        this._defineCustomModel(columns);
        
        var table_store = Ext.create('Rally.data.custom.Store',{ 
            model: 'TSTableRow',
            sorters: [{property:'groupOrder', direction:'ASC'}]
        });
        
        this.grid = this.add({ 
            xtype:'rallygrid', 
            store: table_store,
            columnCfgs: columns,
            showPagingToolbar : false,
            showRowActionsColumn : false,
            sortableColumns: false,
            disableSelection: true,
            viewConfig: {
                stripeRows: true,
                plugins: {
                    ptype: 'gridviewdragdrop',
                    dragText: 'Drag and drop to reorder'
                }
            }
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
                    console.error('Problem loading: ' + operation.error.errors.join('. '));
                    Ext.Msg.alert('Problem loading milestones', operation.error.errors.join('. '));
                }
            }
        });
    },

    _defineCustomModel: function(columns) {
        var me = this;
        
        var fields = Ext.Array.map(columns, function(column){
            var name = column.dataIndex;
            var type = 'object';
            if ( name == 'Project' ) { type = 'string'; }
            
            return { name: name, type: type };
        });
        
        fields.push({ name: 'groupOrder', type:'Number' });
        fields.push({ name: 'Predecessor', type:'object'});
        
        Ext.define('TSTableRow', {
            extend: 'Ext.data.Model',
            fields: fields,
            
            addArtifact: function(artifact,milestone) {
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
    
    cardTemplate: new Ext.XTemplate(
        "<tpl for='.'>",
            "<div class='ts_card' id='{ObjectID}' style='background-color:{__StateColor};'>",
                "{Name} ({Children.Count})",
                "{[this.getPredecessorSymbol(values)]}",
            "</div>",
        "</tpl>",
        {
            getPredecessorSymbol:function(record) {
                if ( record.__ChildPredecessorCount && record.__ChildPredecessorCount > 0 ) {
                    return " <span class='icon-predecessor'> </span>";
                }
                return '';
            }
        }
    ),
    
    getCellRenderer: function() {
        var me = this;
        return function(value, meta, record) {
            var card_items = me._setArtifactColor(value);
            return me.cardTemplate.apply(card_items);
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
        
        var milestone_dates_by_oid = {};
        Ext.Array.each(milestones, function(milestone) {
            milestone_dates_by_oid[milestone.get('ObjectID')] = milestone.get('TargetDate');
        });
        
        Ext.Array.each(milestones, function(milestone){
//            var oid = milestone.get('ObjectID');
//            var target_date = milestone.get('TargetDate');
//            
            promises.push( function() { 
                return me._loadArtifactsForMilestone(milestone); 
            });
        });
        
        Deft.Chain.parallel(promises).then({
            scope: this,
            success: function(milestones_with_artifacts) {
                var me = this;
                
                var artifacts_by_milestone = {};
                Ext.Array.each(milestones_with_artifacts, function(artifacts_by_a_milestone){
                    artifacts_by_milestone = Ext.apply(artifacts_by_milestone, artifacts_by_a_milestone);
                });
                
                this._populateChildPredecessors(artifacts_by_milestone).then({
                    scope: this,
                    success: function(artifacts_by_milestone) {
                        this.artifacts_by_oid = this._getArtifactsByOIDFromMilestoneHash(artifacts_by_milestone);
                        
                        var rows_by_project_or_group_name = this._getRowsFromMilestoneHash(artifacts_by_milestone);
                        
                        Ext.Object.each( artifacts_by_milestone, function(milestone, artifacts) {
                            Ext.Array.each(artifacts, function(artifact){
                                var key = me._getProjectGroupIdentifier(artifact.Project);
                                if ( key ) {
                                    rows_by_project_or_group_name[key].addArtifact(artifact,milestone);
                                }
                            });
                        });
                        
                        rows_by_project_or_group_name = this._addRowsWithoutArtifacts(rows_by_project_or_group_name);
                        
                        Ext.Object.each(rows_by_project_or_group_name, function(key, row){
                            table_store.addSorted(row);
                        });
                        
                        this._setCardListeners();
                        this.fireEvent('gridReady', this, this.grid);
                    },
                    failure: function(msg) {
                        Ext.Msg.alert('Problem defining cards', msg);
                    }
                });
            },
            failure: function(msg) {
                Ext.Msg.alert('Problem loading artifacts', msg);
            }
        });
    },
    
    _getArtifactsByOIDFromMilestoneHash: function(artifacts_by_milestone){
        var artifacts_by_oid = {};
        Ext.Object.each(artifacts_by_milestone, function(key,artifacts) {
            Ext.Array.each(artifacts, function(artifact){
                artifacts_by_oid[artifact.ObjectID] = artifact;
            });
        });
        return artifacts_by_oid;
    },
    
    _setCardListeners: function() {
        var cards = Ext.query('.ts_card');
        
        Ext.Array.each(cards, function(card){
            var card_element = Ext.get(card);
            card_element.on('click', function(evt,c) {
                this._showDialogForPI(c.id);
            },this);
        },this);
    },
    
    _addRowsWithoutArtifacts:function(rows_by_project_or_group_name){
        var me = this;
        
        if ( Ext.isEmpty(this.projectGroups) || this.projectGroups == {} ) {
            return rows_by_project_or_group_name;
        }
        
        Ext.Object.each(this.projectGroups, function(key, project_setting) {
            if ( project_setting ) {
                var key = project_setting.groupName || project_setting.Name;
                var group_order = project_setting.groupOrder || -1;
                
                if ( key && Ext.isEmpty(rows_by_project_or_group_name[key] ) ) {
                    rows_by_project_or_group_name[key] = Ext.create('TSTableRow',{
                        Name: key,
                        Project: key,
                        groupOrder: group_order
                    });
                }
            }
        });
        
        return rows_by_project_or_group_name;
    },

    _getProjectGroupIdentifier: function(project) {

        if ( this.projectGroups == {} || Ext.Object.getKeys(this.projectGroups).length === 0 ) {
            return project.Name;
        }
        
        var setting = this.projectGroups[ project._ref ];
        
        if ( setting ) {
            return setting.groupName || project.Name;
        }

        return false;
    },
    
    _getGroupOrder: function(project) {
        if ( Ext.isEmpty(this.projectGroups) || this.projectGroups == {} ) {
            return -1;
        }
        
        var setting = this.projectGroups[ project._ref ];
        
        if ( setting && setting.groupOrder ) {
            return setting.groupOrder;
        }
       
        return -1;
    },
    
    _getRowsFromMilestoneHash: function(artifacts_by_milestone) {
        var rows_by_project_or_group_name = {};
        var me = this;
        
        Ext.Object.each( artifacts_by_milestone, function(milestone, artifacts){
            Ext.Array.each(artifacts, function(artifact) {
                var key = me._getProjectGroupIdentifier(artifact.Project);
                var group_order = me._getGroupOrder(artifact.Project);
                
                if ( key ) {
                    rows_by_project_or_group_name[key] = Ext.create('TSTableRow',{
                        Project: key,
                        groupOrder: group_order
                    });
                }
                
            });
        });
        
        
        return rows_by_project_or_group_name;
    },
    
    _setArtifactColor: function(artifacts) {
        var artifacts_with_color = [];
        Ext.Array.each(artifacts, function(artifact){
            if ( ! Ext.isEmpty(artifact) ) {
                var default_value = this.stateColors.defaultValue;
                if ( default_value.colorStateMapping ) { 
                    default_value = default_value.colorStateMapping;
                }
                var color = default_value || 'Platinum';
                
                if ( artifact.State ) {
                    var value = this.stateColors[artifact.State.Name];
                    
                    if ( !Ext.isEmpty(value) ) { 
                        if ( Ext.isString(value) ) {
                            color = value;
                        } else if ( !Ext.isEmpty( value.colorStateMapping)  ) {
                            color = value.colorStateMapping;
                        }
                    }
                } else {
                    var value = this.stateColors[""];
                    if ( !Ext.isEmpty(value) ) { 
                        if ( Ext.isString(value) ) {
                            color = value;
                        } else if ( !Ext.isEmpty( value.colorStateMapping)  ) {
                            color = value.colorStateMapping;
                        }
                    }
                }
                
                artifact.__StateColor = color;
                artifacts_with_color.push(artifact);
            }
        },this);
        
        return artifacts_with_color;
    },
    
    _loadArtifactsForMilestone: function(milestone) {
        var deferred = Ext.create('Deft.Deferred');
        var me = this;
        
        var milestone_oid = milestone.get('ObjectID');
        var milestone_date = milestone.get('TargetDate');
        
        var config = {
            model:   this.cardModel,
            fetch:   ['FormattedID', 'Name', 'ObjectID','Project','State','Children','Predecessors'],
            filters: [{property:'Milestones.ObjectID', operator: 'contains', value: milestone_oid}]
        };
        
        TSUtilities.loadWSAPIItems(config).then({
            scope: this,
            success: function(artifacts) {
                var artifacts_by_milestone = {};
                artifacts_by_milestone[milestone_date] = Ext.Array.map( artifacts, function(artifact) {
                    var artifact_hash = artifact.getData();
                    artifact_hash.__Milestone = milestone.getData();
                    return artifact_hash; 
                });
                deferred.resolve(artifacts_by_milestone);
            },
            failure: function(msg) {
                deferred.reject(msg);
            }
        });

        return deferred;
    },
    
    _populateChildPredecessors: function(artifacts_by_milestone){
        var deferred = Ext.create('Deft.Deferred');
        
        var artifacts_by_oid = {};
        
        Ext.Object.each(artifacts_by_milestone, function(key, artifacts){
            Ext.Array.each(artifacts, function(artifact){
                artifacts_by_oid[artifact.ObjectID] = artifact;
            });
        });
        
        var artifact_filter = Ext.Array.map(Ext.Object.getValues(artifacts_by_oid), function(artifact){ 
            return { property:'Parent.ObjectID', value: artifact.ObjectID };
        });
        
        if ( artifact_filter.length === 0 ) {
            artifact_filter = [{property:'ObjectID',value: -1}]; // don't look for tasks, but need to fulfill promises
        }
        var config = {
            model: 'PortfolioItem/Feature',
            filters: Rally.data.wsapi.Filter.or(artifact_filter),
            fetch: ['Predecessors','Parent','ObjectID','Milestones']
        };
        
        TSUtilities.loadWSAPIItems(config).then({
            scope: this,
            success: function(children) {

                Ext.Array.each(children, function(child){
                    if ( child.get('Parent') ){
                        var parent_oid = child.get('Parent').ObjectID;
                        var parent = artifacts_by_oid[parent_oid];
                        if ( !parent.__ChildPredecessorCount ) {
                            parent.__ChildPredecessorCount = 0;
                        }
                        var child_predecessor_count = child.get('Predecessors').Count;
                        var parent_predecessor_count = parent.__ChildPredecessorCount;
                        parent.__ChildPredecessorCount = parent_predecessor_count + child_predecessor_count;
                    }
                });
                deferred.resolve(artifacts_by_milestone);
            },
            failure: function(msg) {
                deferred.reject(msg);
            }
        });
        
        return deferred.promise;
    },
    
    _showDialogForPI: function(object_id) {
        var artifact = this.artifacts_by_oid[object_id];
        var me = this;
        
        console.log('artifact', artifact);
        
        var title = Ext.String.format("{0} ({1} - {2})",
            artifact.Name,
            artifact.__Milestone.Name,
            Ext.util.Format.date( artifact.__Milestone.TargetDate, 'm/d/Y' )
        );
        
        Ext.create('Rally.ui.dialog.Dialog', {
            id       : 'popup',
            width    : Ext.getBody().getWidth() - 40,
            height   : Ext.getBody().getHeight() - 40,
            title    : title ,
            autoShow : true,
            closable : true,
            layout   : 'fit',
            items    : [{
                xtype                : 'rallygrid',
                id                   : 'popupGrid',
                showPagingToolbar    : false,
                disableSelection     : true,
                showRowActionsColumn : false,
                enableEditing        : false,
                columnCfgs           : [
                    {dataIndex: 'FormattedID', text:'Feature' },
                    {dataIndex: 'Name', text: 'Name' },
                    {dataIndex: 'State', text: 'State' },
                    {dataIndex: 'PlannedStartDate', text: 'Planned Start' },
                    {dataIndex: 'PlannedEndDate', text: 'Planned End' },
                    {dataIndex: 'LeafStoryCount', text:'Leaf Story Count'},
                    {dataIndex: 'Predecessors', text: 'Predecessors', renderer: me._renderPredecessors }
                ],
                storeConfig          : {
                    pageSize: 10000,
                    model: 'PortfolioItem/Feature', 
                    filters: [{property:'Parent.ObjectID', value: object_id}]
                },
                listeners: {
                    scope: this,
                    render: function(grid){
                        var store = grid.getStore();
                        var me = this;
                        
                        // put predecessor info on page
                        store.on('load', function(store, records){
                            Ext.Array.each( records, function(record) {
                                me._showPredecessorsInDialog(record);
                                me._showMilestonesInDialog(record);
                            });
                        });
                    }
                }
            }]
        });
        
    },
    
    _renderPredecessors: function(value,meta,record) {
        if ( Ext.isEmpty(value) || value.Count === 0 ) {
            return " ";
        }
        var id  = value._ref.replace(/[^a-z0-9]/g, '');
        var html = "<span id='P" + id + "'>" + value.Count + "</span>";
        return html;
    },
    
    _renderMilestones: function(value,meta,record) {
        if ( Ext.isEmpty(value) || value.Count === 0 ) {
            return " ";
        }
        var id  = value._ref.replace(/[^a-z0-9]/g, '');
        var html = "<span id='M" + id + "'>" + value.Count + "</span>";
        return html;
    },
    
    _showPredecessorsInDialog: function(record) {
        var collection_object = record.get('Predecessors');
        if ( collection_object && collection_object.Count > 0 ) {
            var id = collection_object._ref.replace(/[^a-z0-9]/g, '');
            var spans = Ext.query('#P'+id);
            if ( spans.length > 0 ) {
                record.getCollection('Predecessors').load({
                    fetch: ['FormattedID', 'ObjectID', 'Project'],
                    callback: function(records, operation, success) {
                        var display_array = Ext.Array.map(records, function(record) {
                            var url = Rally.nav.Manager.getDetailUrl(record);
                            return Ext.String.format("<span> <a href='{0}'>{1}</a> </span>",
                                url,
                                record.get('FormattedID')
                            );
                                
                        });
                        
                        spans[0].innerHTML = display_array.join(',');
                    }
                });
            }
        }
    },
    
    _showMilestonesInDialog: function(record) {
        var collection_object = record.get('Milestones');
        if ( collection_object && collection_object.Count > 0 ) {
            var id = collection_object._ref.replace(/[^a-z0-9]/g, '');
            var spans = Ext.query('#M'+id);
            if ( spans.length > 0 ) {
                record.getCollection('Milestones').load({
                    fetch: ['FormattedID', 'ObjectID', 'Name', 'TargetDate'],
                    callback: function(records, operation, success) {
                        var display_array = Ext.Array.map(records, function(record) {
                            return Ext.String.format("<span> {0} - {1} </span>",
                                record.get('Name'),
                                Ext.util.Format.date(record.get('TargetDate'),'m/d')
                            );
                                
                        });
                       
                        spans[0].innerHTML = display_array.join(',');
                    }
                });
            }
        }
    }

});
