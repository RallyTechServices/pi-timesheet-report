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
        me.getPortfolioItemTypes().then({
            scope:me,
            success: function(records){
                console.log('getPortfolioItemTypes>>',records);
                me.secondLevelPI = records[1].get('TypePath');
                me._addSelector();
            }
        })
        
        

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
            valueField: 'ObjectID',
            storeConfig: {
                pageSize: 300,
                models: me.secondLevelPI,
                context: {
                    projectScopeUp: true,
                    projectScopeDown: true
                }                
            }
        });

        me.down('#selector_box').add({
            xtype: 'rallydatefield',
            fieldLabel: 'Select Dates:',
            margin: '10 10 10 10',            
            labelAlign: 'right',
            itemId: 'startDate',
            name: 'startDate',
            stateful: true,
            stateId: 'startDateSt'
        });

        me.down('#selector_box').add({
            xtype: 'rallydatefield',
            margin: '10 10 10 10',            
            itemId: 'endDate',
            name: 'endDate',
            stateful: true,
            stateId: 'endDateSt'
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
        this.setLoading("Loading stuff...");
        console.log('selectedPi>>',this.down('#selectedPi').value);

        var model_name = 'TimeEntryValue',
            field_names = ['Feature','PortfolioItem','ObjectID','Name','TimeEntryItem','Hours','DateVal','WorkProduct','Task','User','Project','FormattedId','Parent','WorkProductDisplayString','TaskDisplayString','User','c_PrimarySystemImpacted','c_BusinessSponsor','InvestmentCategory','PlanEstimate','Estimate','c_Capabilities','ToDo','Requirement'];
        
        filters = [{
            property: 'Hours',
            operator: '>',
            value: 0
        }];

        filters.push({
            property: 'DateVal',
            operator: '>',
            value: me.down('#startDate').value            
        });

        filters.push({
            property: 'DateVal',
            operator: '<',
            value: me.down('#endDate').value           
        });

        // filters.push({
        //     property: 'TimeEntryItem.Project.ObjectID',
        //     value: me.getContext().getProject().ObjectID    
        // });


        this._getWorkProductIds().then({
            scope:me,
            success: function(records){
                var object_id_filters = [];
                Ext.Array.each(records,function(ObjectID){
                    object_id_filters.push({
                        property:'TimeEntryItem.WorkProduct.ObjectID',
                        value:ObjectID
                    });                    
                });

                console.log('object_id_filters',object_id_filters);

                if(object_id_filters.length > 0){
                    filters = Rally.data.wsapi.Filter.or(object_id_filters).and(Rally.data.wsapi.Filter.and(filters));
                }else{
                    filters = Rally.data.wsapi.Filter.and(filters);
                }
                
                var config =    {  
                                    model:model_name, 
                                    fetch:field_names,
                                    filters:filters
                                };

                this._loadWsapiRecords(config).then({
                    scope: this,
                    success: function(records) {
                        console.log('records',records)
                        var task_records = {}
                        Ext.Array.each(records,function(rec){
                            var time_entry_item = rec.get('TimeEntryItem');
                            var task_id = time_entry_item.Task && time_entry_item.Task.FormattedID || "No Task" ;
                            
                            var business_sponsor = "";

                            if(time_entry_item.WorkProduct && time_entry_item.WorkProduct._type == 'HierarchicalRequirement'){
                                business_sponsor = time_entry_item.WorkProduct.c_BusinessSponsor || ""
                            }else if(time_entry_item.WorkProduct && time_entry_item.WorkProduct._type == 'Defect'){
                                business_sponsor = time_entry_item.WorkProduct.c_BusinessSponsor ? time_entry_item.WorkProduct.c_BusinessSponsor : time_entry_item.WorkProduct.Requirement.c_BusinessSponsor || "";
                            }

                            var primary_system_impacted = "";

                            if(time_entry_item.WorkProduct && time_entry_item.WorkProduct._type == 'HierarchicalRequirement'){
                                primary_system_impacted = time_entry_item.WorkProduct.c_PrimarySystemImpacted || ""
                            }else if(time_entry_item.WorkProduct && time_entry_item.WorkProduct._type == 'Defect'){
                                primary_system_impacted = time_entry_item.WorkProduct.c_PrimarySystemImpacted ? time_entry_item.WorkProduct.c_PrimarySystemImpacted : time_entry_item.WorkProduct.Requirement.c_PrimarySystemImpacted || "";
                            }

                            if(task_records[task_id]){
                                task_records[task_id].Hours += rec.get('Hours');
                            }else{
                                task_records[task_id] = {
                                    'Initiative': time_entry_item.WorkProduct && time_entry_item.WorkProduct.Feature && time_entry_item.WorkProduct.Feature.Parent,
                                    'Feature': time_entry_item.WorkProduct && time_entry_item.WorkProduct.Feature,
                                    'InvestmentCategory':time_entry_item.WorkProduct && time_entry_item.WorkProduct.Feature && time_entry_item.WorkProduct.Feature.InvestmentCategory,
                                    'Capabilities': time_entry_item.WorkProduct && time_entry_item.WorkProduct.Feature && time_entry_item.WorkProduct.Feature.Parent && me._getMultiValues(time_entry_item.WorkProduct.Feature.Parent.c_Capabilities),
                                    'WorkItem': time_entry_item.WorkProduct,
                                    'PlanEstimate': time_entry_item.WorkProduct && time_entry_item.WorkProduct.PlanEstimate,
                                    'Task' : time_entry_item.Task,
                                    'TaskEstimate' : time_entry_item.Task && time_entry_item.Task.Estimate,
                                    'TaskToDo' : time_entry_item.Task && time_entry_item.Task.ToDo,
                                    'User': time_entry_item.User && time_entry_item.User._refObjectName || "",
                                    'Project': time_entry_item.Project && time_entry_item.Project._refObjectName || "",
                                    'BusinessSponsor': business_sponsor,
                                    'PrimarySystemImpacted':primary_system_impacted,
                                    'Hours': rec.get('Hours')
                                };
                            }
                        });
                        
                        console.log('custom task records>>', task_records);
                        var store = Ext.create('Rally.data.custom.Store',{
                            data: Ext.Object.getValues(task_records)
                        });
                        this._displayGrid(store);

                    },
                    failure: function(error_message){
                        alert(error_message);
                    }
                }).always(function() {
                    me.setLoading(false);
                });                
            }
        })
    },

    _getMultiValues: function(multiValue){
        return _.map(multiValue._tagsNameArray, 'Name')
    },

    _getWorkProductIds: function(){
        var deferred = Ext.create('Deft.Deferred');
        var me = this;
        var piObjectID = me.down('#selectedPi').value;
        var work_product_ids = [];
        if(!this.down('#selectedPi').value){
            deferred.resolve([]);
        }else{
            var us_filters = [{property:'Feature.Parent.ObjectID',value:piObjectID}]

           me._loadWsapiRecords({model:'HierarchicalRequirement',fetch:['ObjectID'],filters:us_filters}).then({
                scope:me,
                success:function(records){
                    console.log('_getWorkProductIds>>',records);
                    var defect_filters = [];
                    Ext.Array.each(records,function(us){
                        work_product_ids.push(us.get('ObjectID'));
                        defect_filters.push({
                            property:'Requirement.ObjectID',
                            value:us.get('ObjectID')
                        });
                        me._loadWsapiRecords({model:'Defect',fetch:['ObjectID'],filters:Rally.data.wsapi.Filter.or(defect_filters)}).then({
                            scope:me,
                            success: function(records){
                                Ext.Array.each(records,function(defect){
                                    work_product_ids.push(defect.get('ObjectID'));
                                });
                                console.log('work_product_ids',work_product_ids);
                                 deferred.resolve(work_product_ids);
                            }
                        })
                    });
                }
            });
        }
        return deferred.promise;
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
        var me = this;
        this.down('#display_box').removeAll();
        this.down('#display_box').add({
            xtype: 'rallygrid',
            store: store,
            showRowActionsColumn: false,
            columnCfgs: [   
                            {
                                dataIndex:'Initiative',
                                text:'Initiative',
                                flex:1,
                                renderer: function(value){
                                  return value && Ext.create('Rally.ui.renderer.template.FormattedIDTemplate').apply(value) + ' : ' + value.Name;
                                }
                                ,
                                exportRenderer:function(value){
                                    return value && value.FormattedID + ' : ' + value.Name || "";
                                },
                                doSort    : function(direction) {
                                    me._sortStore({
                                        store       : this.up('rallygrid').getStore(),
                                        direction   : direction,
                                        columnName  : 'Initiative',
                                        subProperty : 'FormattedID'
                                    });
                                }
                            },
                            {
                                dataIndex:'Capabilities',
                                text:'Capabilities',
                                flex:1
                            },                            
                            {
                                dataIndex:'Feature',
                                text:'Feature',
                                flex:1,
                                renderer: function(value){
                                  return value && Ext.create('Rally.ui.renderer.template.FormattedIDTemplate').apply(value) + ' : ' + value.Name;
                                }
                                ,
                                exportRenderer:function(value){
                                    return value && value.FormattedID + ' : ' + value.Name || "";
                                },
                                doSort    : function(direction) {
                                    me._sortStore({
                                        store       : this.up('rallygrid').getStore(),
                                        direction   : direction,
                                        columnName  : 'Feature',
                                        subProperty : 'FormattedID'
                                    });
                                }
                            },
                            {
                                dataIndex:'InvestmentCategory',
                                text:'Investment Category',
                                flex:1
                            },                            
                            {
                                dataIndex:'WorkItem',
                                text:'Work Item',
                                flex:1,
                                renderer: function(value){
                                  return value && Ext.create('Rally.ui.renderer.template.FormattedIDTemplate').apply(value) + ' : ' + value.Name;
                                }
                                ,
                                exportRenderer:function(value){
                                    return value && value.FormattedID + ' : ' + value.Name || "";
                                },
                                doSort    : function(direction) {
                                    me._sortStore({
                                        store       : this.up('rallygrid').getStore(),
                                        direction   : direction,
                                        columnName  : 'WorkItem',
                                        subProperty : 'FormattedID'
                                    });
                                }
                            }, 
                            {
                                dataIndex:'PlanEstimate',
                                text:'Plan Estimate',
                                flex:1
                            },                                                                
                            {
                                dataIndex:'Task',
                                text:'Task',
                                flex:1,
                                renderer: function(value){
                                  return value && Ext.create('Rally.ui.renderer.template.FormattedIDTemplate').apply(value) + ' : ' + value.Name;
                                }
                                ,
                                exportRenderer:function(value){
                                    return value && value.FormattedID + ' : ' + value.Name || "";
                                },
                                doSort    : function(direction) {
                                    me._sortStore({
                                        store       : this.up('rallygrid').getStore(),
                                        direction   : direction,
                                        columnName  : 'Task',
                                        subProperty : 'FormattedID'
                                    });
                                }
                            },     
                            {
                                dataIndex:'TaskEstimate',
                                text:'Task Estimate',
                                flex:1
                            },     
                            {
                                dataIndex:'TaskToDo',
                                text:'To Do',
                                flex:1
                            },
                            {
                                dataIndex:'Hours',
                                text:'Time Spent'
                            },                                                       
                            {
                                dataIndex:'User',
                                text:'User'
                            }, 
                            {
                                dataIndex:'Project',
                                text:'Team',
                                flex:1
                            },{
                                dataIndex:'BusinessSponsor',
                                text:'Business Sponsor'
                            },
                            {
                                dataIndex:'PrimarySystemImpacted',
                                text:'Primary System Impacted'
                            }     
                            ],
                    width:this.getWidth()
        });
    },

    _sortStore: function(config) {
        config.store.sort({
            property  : config.columnName,
            direction : config.direction,
            sorterFn  : function(v1, v2){
                v1 = (config.subProperty) ? v1.get(config.columnName) && v1.get(config.columnName)[config.subProperty] || '' : v1.get(config.columnName) || '';
                v2 = (config.subProperty) ? v2.get(config.columnName) && v2.get(config.columnName)[config.subProperty] || '' : v2.get(config.columnName) || '';
                return v1 > v2 ? 1 : v1 < v2 ? -1 : 0;
            }
        });
    },

    getPortfolioItemTypes: function(workspace) {
        var deferred = Ext.create('Deft.Deferred');
                
        var store_config = {
            fetch: ['Name','ElementName','TypePath'],
            model: 'TypeDefinition',
            filters: [
                {
                    property: 'Parent.Name',
                    operator: '=',
                    value: 'Portfolio Item'
                },
                {
                    property: 'Creatable',
                    operator: '=',
                    value: 'true'
                }
            ],
            autoLoad: true,
            listeners: {
                load: function(store, records, successful) {
                    if (successful){
                        deferred.resolve(records);
                    } else {
                        deferred.reject('Failed to load types');
                    }
                }
            }
        };
        
        if ( !Ext.isEmpty(workspace) ) {            
            store_config.context = { 
                project:null,
                workspace: workspace._ref ? workspace._ref : workspace.get('_ref')
            };
        }
                
        var store = Ext.create('Rally.data.wsapi.Store', store_config );
                    
        return deferred.promise;
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
