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
            pdfOrientation: 'landscape',
            projectGroupsWithOrder: {}
        }
    },
    
    layout: { type: 'border' },
    
    items: [
        {xtype:'container', region: 'north', itemId:'selector_box', layout: 'hbox'},
        {xtype:'container', region: 'center', itemId:'display_box', layout: 'fit'},
        {xtype:'container', region: 'south', itemId:'legend_box', layout: 'hbox'}
    ],
    // TODO
    integrationHeaders : {
        name : "TSMilestoneRoadmapApp"
    },
    
    startDate: Rally.util.DateTime.add(new Date(), 'month', -1),
    monthCount: 9,
    
    launch: function() {
        var me = this;
        
        this.app_title = "No Title";
        
        if ( !this.isExternal() ) {
            this.app_title = this._getPanelTitle();
        }
        
        this.colors = this.getSetting('colorStateMapping');
        this.projectGroups = this.getSetting('projectGroupsWithOrder');
        
        if ( Ext.isString(this.colors) ) { this.colors = Ext.JSON.decode(this.colors); }
        if ( Ext.isString(this.projectGroups) ) { this.projectGroups = Ext.JSON.decode(this.projectGroups); }

        this._addLegend(this.down('#legend_box'), this.colors);
        this._addSelectors(this.down('#selector_box'));
        
        this._makeCardBoard();
    },
    
    _makeCardBoard: function() {
        var me = this;
        this.setLoading("Loading milestones...");
        if ( this.down('tsroadmaptable') ) { this.down('tsroadmaptable').destroy(); }
        
        this.logger.log("Making new grid ", this.monthCount, " from " , this.startDate);
        
        this._getAppropriatePIType().then({
            scope  : this,
            success: function(types) {
                this.setLoading('Loading items...');
                
                this.PortfolioItemType = types[0];
                this.logger.log('PI Type:', this.PortfolioItemType);
                
                var start_date = this.startDate;
                var month_count = this.monthCount;
                
                this.roadmap = this.down('#display_box').add({ 
                    xtype: 'tsroadmaptable',
                    startDate: start_date,
                    monthCount: month_count,
                    stateColors: this.colors,
                    projectGroups: this.projectGroups,
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
                me.setLoading(false);
            }
        });
    },
    
    _addSelectors: function(container) {
        var me = this;
        
        container.add({
            xtype: 'rallydatefield',
            itemId: 'start_date_selector',
            fieldLabel: 'First Month',
            labelWidth: 65,
            padding: 10,
            value: me.startDate,
            listeners: {
                scope: this,
                change: this._updateDateValues
            }
        });

        container.add({
            xtype: 'rallydatefield',
            itemId: 'end_date_selector',
            fieldLabel: 'Last Month',
            labelWidth: 65,
            padding: 10,
            value: Rally.util.DateTime.add(me.startDate,'month',me.monthCount-1),
            listeners: {
                scope: this,
                change: this._updateDateValues
            }
        });
        
        container.add({
            xtype:'container',
            itemId: 'spacer',
            flex: 1
        });
        
        container.add({
            xtype:'rallybutton',
            text: '<span class="icon-export"> </span>',
            listeners: {
                scope: this,
                click: this._makePDF
            }
        });
        
    },
    
    _makePDF: function() {
        // requires jsPDF
        var me = this;
        
        this.setLoading('Generating PDF...');

        var options = {
            format : 'PNG',
            width: null,
            height: null
//            dim: { h: 0, w: Ext.getBody().getWidth() }
        }

        //relaunch to make it go on forever because scrolling interferes with the pdf
        var popup = Ext.create('Rally.ui.dialog.Dialog', {
            id       : 'popup',
            width    : Ext.getBody().getWidth() - 40,
            height   : 7000,
            title    : 'make pdf' ,
            autoShow : true,
            closable : false,
            autoScroll: false,
            autoCenter: false,
           
            items    : [{
                xtype:'container',
                id: 'pdf_box',
                items: [
                    {
                        itemId: 'pdf_title_box',
                        xtype:'container',
                        cls: 'tstitle',
                        margin: 15,
                        html: me.app_title
                    },
                    {
                        id: 'pdf_grid_box',
                        itemId: 'pdf_grid_box',
                        xtype:'container',
                        margin: '10px 50px 5px 50px'
                    }
                ]
            }]
        });
        
        var start_date = this.startDate;
        var month_count = this.monthCount;
        
        var orientations = { 'landscape': 'l', 'portrait': 'p' };

        var orientation = orientations[this.getSetting('pdfOrientation')] || 'l';
        
        popup.down('#pdf_grid_box').add({
            xtype: 'tsroadmaptable',
            startDate: start_date,
            monthCount: month_count,
            stateColors: this.colors,
            projectGroups: this.projectGroups,
            cardModel: this.PortfolioItemType.get('TypePath'),
            listeners: {
                gridReady: function() {
//                    var pdf_html = document.getElementById('pdf_box');
//                    
//                    var pdf = new jsPDF(orientation,'pt','letter');
//                    
//                    pdf.addHTML(pdf_html, options, function () {
//                        pdf.save('roadmap.pdf');
//                        me.setLoading(false);
//                        popup.destroy();
//                    });
                     
                }
            }
        });

    },
    
    _updateDateValues: function() {
        var start_date = this.down('#start_date_selector').getValue();
        var end_date = this.down('#end_date_selector').getValue();
        
        if ( Ext.isEmpty(start_date) || Ext.isEmpty(end_date) ) {
            return;
        }
        
        if ( start_date >= end_date ) {
            return;
        }
        
        this.startDate = Ext.clone(start_date);
        start_date.setDate(1);
        end_date.setDate(1);
        
        this.monthCount = Rally.util.DateTime.getDifference(end_date, start_date, 'month') + 1;
        this._makeCardBoard();
    },
    
    _addLegend: function(container,colors) {
        container.removeAll();
        container.add({ xtype:'container', itemId: 'spacer', flex: 1});
        
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
    
    _getPanelTitle: function() {
        var title = "Could not find title";
        
        var iframe_parent = window.frameElement ? window.frameElement.parentNode : null;

        // pop outsied the iframe
        var grandparent = Ext.get(iframe_parent.parentNode);
        // search up the tree for the portlet 
        var panel_top = Ext.get(grandparent.parent('.x-portlet'));
        // search back down for the title bar
        var title_bars = panel_top.query('.x-panel-header-text');
        
        if ( title_bars.length > 0 ) {
            title = title_bars[0].innerHTML;
        }
        return title;
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
            height: 175,
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
        },
        {
            name: 'pdfOrientation',
            fieldLabel: 'PDF Orientation',
            xtype: 'rallycombobox',
            store: Ext.create('Rally.data.custom.Store',{ data: [
                {displayName:'Landscape', value: 'l'},
                {displayName:'Portrait',  value: 'p'}
            ]}),
            displayField: 'displayName',
            valueField: 'value',
            readyEvent: 'ready'

        }];
    }
});
