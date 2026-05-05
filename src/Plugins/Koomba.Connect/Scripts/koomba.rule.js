
$(".providerDrop").change(function (e) {
    var Id = $(this).attr("ruleid");
    rebuildRule(Id);
});

$(".condition-check input").change(function (e) {
    var Id = $(this).parent().parent().attr("ruleid");
    console.log("condition");
    rebuildRule(Id);
});

function rebuildRule(Id) {
    var viewCont = $("#providerView_" + Id);
    console.log("change");
    //if (Id == 0) {
    //    Id = 1000;
    //}
    var model = GetInputsData(Id);
    model.Value = "";
    $.post('/Plugins/Koomba.Connect/Rule/GetRuleView', { systemName: this.value, model: model }, function (view) {
        console.log("change");
        console.log(view);
        viewCont.html(view);
        PrepareInputs(Id);
    });
 
}

$(".actionProviderDrop select").change(function (e) {
    var Id = $(this).parent().attr("ruleid");
    var fieldAttr = $(this).find("option:selected").attr("tofield").toLowerCase();   
    var field = (fieldAttr == 'true');
    ActionToFieldCheck(Id, field);
    rebuildAction(Id);
});

$(".action-check input").change(function (e) {   
    var Id = $(this).parent().parent().attr("ruleid");
    rebuildAction(Id);
});

function ActionToFieldCheck(Id, ToField) {
    console.log(ToField);
    var input = $("#IsActionToField_" + Id);
    var inputCont = $("#IsActionToFieldCont_" + Id);
    if (ToField) {
        inputCont.removeClass("d-none");
    }else {
        if ($("#IsActionToField_" + Id).is(":checked")) {
            input.click();
            console.log("checked");
        }
        console.log("hide");
        inputCont.addClass("d-none");
    }
}

function PrepareInputs(id) {
    $("#rule-form-" + id).validate();
    $("#rule-form-" + id + " [data-val-required]").each(function (index) {
        $(this).rules("add", "required");
    });
    console.log($("#rule-form-" + id + " [data-val-required]"));
    $("select").selectWrapper();
}

function rebuildAction(Id) {
    
    var viewCont = $("#actionProviderView_" + Id);
    var model = {
        Id: Id,
        IsActionToField: $("#IsActionToField_" + Id).is(":checked"),
        ActionSystemName: $("#ActionSystemName_" + Id).val(),
        ConnectionId: $("#ConnectionId").val()
    }
    console.log(model);
    $.post('/Plugins/Koomba.Connect/Action/GetRuleView', { model: model }, function (view) {
        viewCont.html(view);
        PrepareInputs(Id);
    });
    
}

function AddRule(id) {
    var valid = $("#rule-form-" + id).valid();
    if (valid) {
        $.post("AddRule", GetInputsData(id), function (e) {
            document.location.reload(true);
        });
    }
}

function UpdateRule(id) {
    console.log(id);
    var valid = $("#rule-form-" + id).valid();
    if (valid) {
        $.post("UpdateRule", GetInputsData(id), function (e) {
            document.location.reload(true);
        });
    }
    
}

function DeleteRule(id) {
    $.post("DeleteRule", GetInputsData(id), function (e) {
        document.location.reload(true);
    });
}

function GetInputsData(id) {
    var rule =
        {
            Id: id,
            SystemName: $("#SystemName_" + id).val(),
            Field: $("#Field_" + id).val(),
            SmartField: $("#SmartField_" + id).val(),
            Value: $("#Value_" + id).val(),
            ExtraData: $("#ExtraData_" + id).val(),
            ChainRuleId: $("#Id").val(),
            ActionSystemName: $("#ActionSystemName_" + id).val(),
            ActionValue: $("#ActionValue_" + id).val(),
            ActionExtraData: $("#ActionExtraData_" + id).val(),
            FieldMapId: $("#FieldMapId").val(),
            MultiRuleListId: $("#MultiRuleListId").val(),
            IsOpposite: $("#IsOpposite_" + id).is(":checked"),
            IsActionToField: $("#IsActionToField_" + id).is(":checked"),
            IsConditionToField: $("#IsConditionToField_" + id).is(":checked"),
            Order: $("#Order_" + id).val(),
            Type: $("#Type").val(),
            ConnectionId: $("#ConnectionId").val()
        }
    console.log(rule);
    return rule;
}

