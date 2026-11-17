sap.ui.define([
"sap/ui/core/mvc/Controller",
"sap/m/MessageToast"
], function(Controller, MessageToast) {
"use strict";

return Controller.extend("cricket.controller.Login", {

onLogin: function(){

var user = this.byId("username").getValue();
var pass = this.byId("password").getValue();

if(user === "admin" && pass === "1234"){

this.getOwnerComponent().getRouter().navTo("dashboard");

}else{

MessageToast.show("Invalid Login");

}

}

});
});