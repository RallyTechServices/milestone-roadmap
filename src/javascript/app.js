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
        
        this._loadPITypes().then({
            success: function(pi_types) {
                this.pi_types = pi_types;
                
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
            failure: function(msg) {
                Ext.Msg.alert('Problem Learning PI Types', msg);
            },
            scope: this
        });
    },
    
    _makeCardBoard: function() {
        var me = this;
        if ( this.down('tsroadmaptable') ) { this.down('tsroadmaptable').destroy(); }
        
        this.logger.log("Making new grid ", this.monthCount, " from " , this.startDate);
        
        this.setLoading('Loading items...');
        
        this.PortfolioItemType = this._getAppropriatePIType();
        this.ChildItemType = this._getChildPIType();
        
        this.logger.log('PI Type:', this.PortfolioItemType);
        
        var start_date = this.startDate;
        var month_count = this.monthCount;
        
        this.roadmapConfig = { 
            xtype: 'tsroadmaptable',
            childPITypePath: this.ChildItemType.get('TypePath'),
            startDate: start_date,
            monthCount: month_count,
            stateColors: this.colors,
            projectGroups: this.projectGroups,
            cardModel: this.PortfolioItemType.get('TypePath')
        };
        
        var config = Ext.clone(this.roadmapConfig);
        
        config.listeners =  {
            gridReady: function() {
                me.setLoading(false);
            }
        };
        
        this.roadmap = this.down('#display_box').add(config);
                
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
                        itemId: 'pdf_legend_box',
                        xtype:'container',
                        cls: 'tslegend',
                        layout: 'hbox',
                        margin: 15
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

        var orientation = orientations[me.getSetting('pdfOrientation')] || 'l';
        console.log('orientation', orientation, me.getSetting('pdfOrientation'));
        
        var config = Ext.clone(this.roadmapConfig);
        
        config.listeners =  {
            gridReady: function() {
                var legend_container = popup.down('#pdf_legend_box');
                me._addLegend(legend_container, me.colors);
    
                var pdf_html = document.getElementById('pdf_box');
                
                var pdf = new jsPDF(orientation,'pt','letter');
                
                pdf.addHTML(pdf_html, options, function () {
                    pdf.save('roadmap.pdf');
                    me.setLoading(false);
                    popup.destroy();
                });
                 
            }
        };
        
        popup.down('#pdf_grid_box').add(config);

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
            if ( Ext.isEmpty(name) ){ name = "None"; };
            
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

        // pop outside the iframe
        var grandparent = Ext.get(iframe_parent.parentNode);
        
        // search up the tree for the portlet 
        //var panel_top = Ext.get(grandparent.parent('.x-portlet'));
        var panel_top = grandparent.dom.offsetParent;
                
        // search back down for the title bar
        if ( Ext.isEmpty(panel_top) ) { 
            return title;
        }
        
        var top_element = Ext.get(panel_top);
        
        title = top_element.dom.textContent;
//        var title_bars = panel_top.query('.x-panel-header-text');
//        
//        if ( title_bars.length > 0 ) {
//            title = title_bars[0].innerHTML;
//        }
        return title;
    },
    
    _loadPITypes: function() {
        var config = {
            model: 'TypeDefinition', 
            fetch: ["TypePath"],
            filters: [{ property:'TypePath', operator:'contains', value:'PortfolioItem/'}],
            sorters: [ { property:"Ordinal", direction:'ASC'} ]
        };
        
        return TSUtilities.loadWSAPIItems(config);
    },
    
    _getAppropriatePIType: function() {
        return this.pi_types[1];
    },
    
    _getChildPIType: function() {
        return this.pi_types[0];
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
                {displayName:'Landscape', value: 'landscape'},
                {displayName:'Portrait',  value: 'portrait'}
            ]}),
            displayField: 'displayName',
            valueField: 'value',
            readyEvent: 'ready'

        }];
    }
});
