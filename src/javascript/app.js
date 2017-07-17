Ext.define("PITimesheetReport", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    defaults: { margin: 10 },
    items: [
        {xtype:'container',itemId:'selector_box',layout:{type:'hbox'}},
        {xtype:'container',itemId:'display_box'}
    ],

    integrationHeaders : {
        name : "PITimesheetReport"
    },
                        
    launch: function() {
        var me = this;

        me._addSelector()
        

    },
      
    _addSelector: function(){
        var me = this;
        me.down('#selector_box').add({
            xtype: 'rallyartifactsearchcombobox',
            width: 300,
            margin: '10 10 10 10',
            itemId: 'selectedPi',
            fieldLabel: "Portfolio Item:",
            labelAlign: 'right',
            remoteFilter: true,
            storeConfig: {
                pageSize: 300,
                models: 'PortfolioItem/Initiative'
            }
        });

        me.down('#selector_box').add({
            xtype: 'rallyiterationcombobox',
            itemId: 'selectedIteration',
            width: 500,
            margin: '10 10 10 10',
            itemId: 'selectedIteration',
            fieldLabel: "Iteration:",
            listeners: {
                scope: me,
                change: function(icb) {
                    me.iteration = icb;
                }
            }            
         });

        me.down('#selector_box').add({
            xtype: 'rallybutton',
            text: 'Update',
            margin: '10 10 10 10',
            defaultAlign: 'right',
            listeners: {
                click: this._updateView,
                scope: this
            }
        });

        this.down('#selector_box').add({
            xtype:'rallybutton',
            itemId:'export_button',
            text: 'Download CSV',
            margin:10,

            disabled: false,
            iconAlign: 'right',
            listeners: {
                scope: this,
                click: function() {
                    this._export();
                }
            },
            margin: '10',
            scope: this
        });

    },

    _updateView: function(){
        var me = this;
        console.log('selectedIteration',me.iteration);
        this.setLoading("Loading stuff...");

        var model_name = 'TimeEntryValue',
            field_names = ['Feature','PortfolioItem','ObjectID','Name','TimeEntryItem','Hours','DateVal','WorkProduct','Task','User','Project','FormattedId','Parent','WorkProductDisplayString','TaskDisplayString'];
        
        filters = [{
            property: 'Hours',
            operator: '>',
            value: 0
        }];

        filters.push({
            property: 'DateVal',
            operator: '>',
            value: me.iteration.valueModels[0].get('StartDate')            
        })

        filters.push({
            property: 'DateVal',
            operator: '<',
            value: me.iteration.valueModels[0].get('EndDate')            
        })

        this._loadAStoreWithAPromise(model_name, field_names,filters).then({
            scope: this,
            success: function(store) {
                this._displayGrid(store);
            },
            failure: function(error_message){
                alert(error_message);
            }
        }).always(function() {
            me.setLoading(false);
        });
    },

    _loadWsapiRecords: function(config){
        var deferred = Ext.create('Deft.Deferred');
        var me = this;
        var default_config = {
            model: 'Defect',
            fetch: ['ObjectID']
        };
        this.logger.log("Starting load:",config.model);
        Ext.create('Rally.data.wsapi.Store', Ext.Object.merge(default_config,config)).load({
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

    _loadAStoreWithAPromise: function(model_name, model_fields,filters){
        var deferred = Ext.create('Deft.Deferred');
        var me = this;
        this.logger.log("Starting load:",model_name,model_fields);
          
        Ext.create('Rally.data.wsapi.Store', {
            model: model_name,
            fetch: model_fields,
            filters:filters
        }).load({
            callback : function(records, operation, successful) {
                if (successful){
                    console.log('values>>',records);
                    deferred.resolve(this);
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
            showRowActionsColumn: false,
            columnCfgs: [   {
                                dataIndex:'TimeEntryItem',
                                text:'Initiative',
                                renderer: function(value){
                                    return value.WorkProduct && value.WorkProduct.Feature && value.WorkProduct.Feature.Parent && value.WorkProduct.Feature.Parent.FormattedID || "";
                                }
                            },
                            {
                                dataIndex:'TimeEntryItem',
                                text:'Feature',
                                renderer: function(value){
                                    return value.WorkProduct && value.WorkProduct.Feature && value.WorkProduct.Feature.FormattedID || "";
                                }
                            },                            
                            {
                                dataIndex:'TimeEntryItem',
                                text:'Work Item Type',
                                renderer: function(value){
                                    return value.WorkProduct && value.WorkProduct._type || "";
                                }
                            },                            
                            {
                                dataIndex:'TimeEntryItem',
                                text:'Work Item',
                                renderer: function(value){
                                    return value.WorkProductDisplayString || "";
                                }
                            },                            
                            {
                                //dataIndex:'c_StoryBusinessSponsor',
                                text:'Story Business Sponsor'
                            },
                            {
                                //dataIndex:'c_StoryBusinessSponsor',
                                text:'Defect Business Sponsor'
                            },
                            {
                                //dataIndex:'c_StoryBusinessSponsor',
                                text:'Story Primary System Impacted'
                            },
                            {
                                //dataIndex:'c_StoryBusinessSponsor',
                                text:'Defect Primary System Impacted'
                            },
                            {
                                dataIndex:'Hours',
                                text:'Hours'
                            },
                            {
                                dataIndex:'DateVal',
                                text:'DateVal'
                            }
                            ]
        });
    },

    _export: function(){
        var grid = this.down('rallygrid');
        var me = this;

        if ( !grid ) { return; }
        
        this.logger.log('_export',grid);

        var filename = Ext.String.format('pi-timesheet-report.csv');

        this.setLoading("Generating CSV");
        Deft.Chain.sequence([
            function() { return Rally.technicalservices.FileUtilities._getCSVFromCustomBackedGrid(grid) } 
        ]).then({
            scope: this,
            success: function(csv){
                if (csv && csv.length > 0){
                    Rally.technicalservices.FileUtilities.saveCSVToFile(csv,filename);
                } else {
                    Rally.ui.notify.Notifier.showWarning({message: 'No data to export'});
                }
                
            }
        }).always(function() { me.setLoading(false); });
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
    }
    
});
