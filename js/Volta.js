/******************************************************************************
Project          :  AI Engineering Calculator by William Yap
Module           :  Volta.js | jQuery/Javascript
Description      :  Computation Engine and data operations
******************************************************************************
Author           :  William Yap
******************************************************************************
TERMS OF USE     :  This module is copyrighted. You can use it provided that
                 :  you keep the original copyright note.
******************************************************************************/

// BINARY OPERATION CODES ****************************************************
// nop      :0
// add      :1
// subtract :2
// mult     :3
// div      :4
// y^x      :5
// %        :6
// RR       :10
// FLC      :11

// ****** GLOBAL CONST *******************************************************
var strEmpty = "";
var strMore = '&#9660;';
var strLess = '&#9650;';

// input string length limit
var maxLength = 14;

// ****** GLOBAL VAR *********************************************************
// operation code
var opCode = 0;
// stack memory register
var stackVal = 0;
// flag to clear input box on data pre-entry
var boolClear = true;
// calculator state: normal or expanded
var oscExtState = false;
//var arrLinks;

// * MAIN *
$(document).ready(function () {

    // ON LOAD **
    $("div.oscExtControl").fadeTo(1000, 0.25,
    function () { $("div.oscExtControl").fadeTo(1000, 1.00); });
    //
    $("div.voltExtPanel").slideToggle("fast");
    $("div.oscStackRegister").slideToggle("fast");

    // **  Load XML DOC: E-SERIES **
    // for Firefox, Chrome, Opera, Safari
    if (window.XMLHttpRequest) {xmlhttpE = new XMLHttpRequest();}
    else // for IE6, IE5
    {
        xmlhttpE = new ActiveXObject("Microsoft.XMLHTTP");
    }
    xmlhttpE.open("GET", "../Volta/ESeries.xml", false);
    xmlhttpE.send();
    xmlDocE = xmlhttpE.responseXML;

    // output Table
    var _tab = $("#refTabESeries");
    var _seriesOpened = [];

    // SHOW STACK REGISTER CONTENT and OpCode *****
    $("div.oscStackControl").mouseover(function () {
        var ctl = $("div.oscStackRegister");
        var op = "";
        if (opCode == 1) op = " +";
        else if (opCode == 2) op = " -";
        else if (opCode == 3) op = " *";
        else if (opCode == 4) op = " /";
        else if (opCode == 5) op = " ^";
        else if (opCode == 6) op = " %";
        ctl.html(stackVal + op);
        ctl.show();
    })
    .mouseout(function () { $("div.oscStackRegister").hide(); })
    .mouseleave(function () { $("div.oscStackRegister").hide(); });

    // close stack register div
    $("div.oscStackRegister").click(function ()
    { $("div.oscStackRegister").hide(); });
    $(this).click(function () { $("div.oscStackRegister").hide(); });

    // CLEAR MEM ON CLICK
    $("div.oscMemLabel").click(function () { $(keyPad_Mem).val(strEmpty); });

    // TOGGLE EXT PANEL ON CLICK
    $("div.oscExtControl").click(function () {
        var ctl = $(this);
        $("div.voltExtPanel").slideToggle("fast", function () {
            oscExtState = !oscExtState;
            if (oscExtState) ctl.html(strLess); else ctl.html(strMore);
        });
    });

    // DATA ENTRY: NUMERIC KEYS
    $("div#keyPad button.keyPad_btnNumeric").click(function () {
        var btnVal = $(this).html();
        // MOD 03/16
        var inBox = $('input#keyPad_UserInput');

        // clear input box if flag set
        if (boolClear) { inBox.val(strEmpty); boolClear = false; }
        var str = inBox.val();

        // limit the input length
        if (str.length > maxLength) return;

        // prevent duplicate dot entry
        if (this.id == "keyPad_btnDot" && str.indexOf('.') >= 0) return;

        // clear input box if not a valid content
        if (!IsValidString(inBox.val())) inBox.val(strEmpty);

        inBox.val(str + btnVal);
        inBox.focus();
    });

    // CONST KEY DATA ENTRY ***********************
    $("button.keyPad_btnConst").click(function () {
        var retVal = strEmpty;
        var inBox;

        switch (this.id) {
            // PI                                                                              
            case 'keyPad_btnPi': retVal = Math.PI; break;
            // PI/2                                                                              
            case 'keyPad_btnPiDiv2': retVal = Math.PI / 2; break;
            // PI/3                                                                              
            case 'keyPad_btnPiDiv3': retVal = Math.PI / 3; break;
            // PI/4                                                                              
            case 'keyPad_btnPiDiv4': retVal = Math.PI / 4; break;
            // PI/6                                                                              
            case 'keyPad_btnPiDiv6': retVal = Math.PI / 6; break;
            // e                                                                              
            case 'keyPad_btnE': retVal = Math.E; break;
            // 1/e                                                                              
            case 'keyPad_btnInvE': retVal = 1 / Math.E; break;
            // SQRT(2)                                                                              
            case 'keyPad_btnSqrt2': retVal = Math.SQRT2; break;
            // SQRT(3)                                                                              
            case 'keyPad_btnSqrt3': retVal = Math.sqrt(3); break;
            // CUBE ROOT OF(3)                                                                              
            case 'keyPad_btnCubeRoot2': retVal = Math.pow(2, 1 / 3); break;
            // Ln(10)                                                                              
            case 'keyPad_btnLn10': retVal = Math.LN10; break;
            // base10: Log(e)                                                                              
            case 'keyPad_btnLgE': retVal = Math.LOG10E; break;
            // Sigmas: defects probability: on scale 0...1                                                                               
            // 1 Sigma                                                                              
            case 'keyPad_btnSigma': retVal = 0.69; break;
            // 3 Sigma                                                                               
            case 'keyPad_btnSigma3': retVal = 0.007; break;
            // 6 Sigma                                                                               
            case 'keyPad_btnSigma6': retVal = 3.4 * Math.pow(10, -6); break;
            default: break;
        }
        boolClear = true;
        inBox = $('input#keyPad_UserInput');
        inBox.focus();
        inBox.val(retVal);
    });

    // BINARY OPERATION KEY *************************************
    $("div#keyPad button.keyPad_btnBinaryOp").click(function () {
        var inBox = $('input#keyPad_UserInput');
        var newOpCode = 0;

        // validate input box
        if (!IsValidString(inBox.val())) { inBox.val(strEmpty); return; }
        if (IsEmpty(inBox.val()) && IsEmpty(stackVal)) { return; }

        switch (this.id) {
            case 'keyPad_btnPlus': newOpCode = 1; break;
            case 'keyPad_btnMinus': newOpCode = 2; break;
            case 'keyPad_btnMult': newOpCode = 3; break;
            case 'keyPad_btnDiv': newOpCode = 4; break;
            case 'keyPad_btnYpowX': newOpCode = 5; break;
            case 'keyPad_btnPercent':
                if (opCode == 1 || opCode == 2)
                { inBox.val(stackVal * parseFloat(inBox.val()) / 100); }
                else if (opCode == 3 || opCode == 4)
                { inBox.val(parseFloat(inBox.val()) / 100); }
                else return;
                break;
            case 'keyPad_btnRR': newOpCode = 10; break;
            case 'keyPad_btnFLC': newOpCode = 11; break;
            default: break;
        }
        if (opCode) { oscBinaryOperation(); }
        else { stackVal = parseFloat(inBox.val()); boolClear = true; }
        opCode = newOpCode;
        inBox.focus();
    });

    // BINARY COMPUTATION *********
    function oscBinaryOperation() {
        var inBox = $('input#keyPad_UserInput');

        // parse input
        var x2 = parseFloat(inBox.val());

        switch (opCode) {
            case 1: stackVal += x2; break;
            case 2: stackVal -= x2; break;
            case 3: stackVal *= x2; break;
            case 4: stackVal /= x2; break;
            // stack power inputBox                                                        
            case 5: stackVal = Math.pow(stackVal, x2); break;
            //RR   
            case 10: stackVal = (stackVal * x2) / (stackVal + x2); break;
            //FLC   
            case 11: stackVal = 1 / (2 * Math.PI * Math.sqrt(stackVal * x2)); break;
            default: break;
        }

        boolClear = true;
        inBox.val(stackVal);
        inBox.focus();
    }

    // PREFIX OPERATIONS ***************************
    $("button.keyPad_btnPrefix").click(function () {
        var oscInBox = $('input#keyPad_UserInput');
        var x;
        var retVal;

        // validate input box
        if (!IsValidString(oscInBox.val())) { oscInBox.val(strEmpty); return; }
        if (IsEmpty(oscInBox.val())) { return; }

        // get input value
        x = parseFloat(oscInBox.val());

        switch (this.id) {
            // =*1000   
            case 'keyPad_btnKilo': x *= 1000; break;
            // =*1000000   
            case 'keyPad_btnMega': x *= 1000000; break;
            // =*1000,000,000   
            case 'keyPad_btnGiga': x *= 1000000000; break;
            // =/1000    
            case 'keyPad_btnMilli': x /= 1000; break;
            // =/1000000    
            case 'keyPad_btnMicro': x /= 1000000; break;
            // =/1000,000,000    
            case 'keyPad_btnNano': x /= 1000000000; break;
            default: break;
        }
        oscInBox.val(x);
        oscInBox.focus();
    });

    // UNARY OPERATIONS *****************************
    $("button.keyPad_btnUnaryOp").click(function () {
        var oscInBox = $('input#keyPad_UserInput');
        var x;
        var retVal;

        // validate input box
        if (!IsValidString(oscInBox.val())) { oscInBox.val(strEmpty); return; }
        if (IsEmpty(oscInBox.val())) { return; }

        // get input value
        x = parseFloat(oscInBox.val());

        switch (this.id) {
            // +/-                                                                           
            case 'keyPad_btnInverseSign': retVal = -x; break;
            // 1/X                                                                           
            case 'keyPad_btnInverse': retVal = 1 / x; break;
            // X^2                                                                           
            case 'keyPad_btnSquare': retVal = x * x; break;
            // SQRT(X)                                                                           
            case 'keyPad_btnSquareRoot': retVal = Math.sqrt(x); break;
            // X^3                                                                           
            case 'keyPad_btnCube': retVal = x * x * x; break;
            // POW (X, 1/3)                                                                           
            case 'keyPad_btnCubeRoot': retVal = Math.pow(x, 1 / 3); break;
            // NATURAL LOG                                                                           
            case 'keyPad_btnLn': retVal = Math.log(x); break;
            // LOG BASE 10                                                                           
            case 'keyPad_btnLg': retVal = Math.log(x) / Math.LN10; break;
            // E^(X)                                                                           
            case 'keyPad_btnExp': retVal = Math.exp(x); break;
            // SIN                                                                           
            case 'keyPad_btnSin': retVal = Math.sin(x); break;
            // COS                                                                           
            case 'keyPad_btnCosin': retVal = Math.cos(x); break;
            // TAN                                                                           
            case 'keyPad_btnTg': retVal = Math.tan(x); break;
            // CTG                                                                           
            case 'keyPad_btnCtg': retVal = 1 / Math.tan(x); break;

            // Arcsin                                                                          
            case 'keyPad_btnAsin': retVal = Math.asin(x); break;
            // Arccos                                                                          
            case 'keyPad_btnAcos': retVal = Math.acos(x); break;
            // Arctag                                                                          
            case 'keyPad_btnAtan': retVal = Math.atan(x); break;

            // Secant                                                                          
            case 'keyPad_btnSec': retVal = 1 / Math.cos(x); break;
            // Cosecant                                                                          
            case 'keyPad_btnCosec': retVal = 1 / Math.sin(x); break;

            // sinh                                                                            
            case 'keyPad_btnSinH':
                retVal = (Math.pow(Math.E, x) - Math.pow(Math.E, -x)) / 2; break;
            // cosh                                                                            
            case 'keyPad_btnCosinH':
                retVal = (Math.pow(Math.E, x) + Math.pow(Math.E, -x)) / 2; break;
            // coth                                                                            
            case 'keyPad_btnTgH':
                retVal = (Math.pow(Math.E, x) - Math.pow(Math.E, -x));
                retVal /= (Math.pow(Math.E, x) + Math.pow(Math.E, -x));
                break;
            // Secant hyperbolic                                                                           
            case 'keyPad_btnSecH':
                retVal = 2 / (Math.pow(Math.E, x) + Math.pow(Math.E, -x)); break;
            // Cosecant hyperbolic                                                                           
            case 'keyPad_btnCosecH':
                retVal = 2 / (Math.pow(Math.E, x) - Math.pow(Math.E, -x)); ; break;
            // 1+x                                                                          
            case 'keyPad_btnOnePlusX': retVal = 1 + x; break;
            // 1-x                                                                          
            case 'keyPad_btnOneMinusX': retVal = 1 - x; break;

            // ELECTRICAL ENGINEERING ************************************   
            // Zc (60 Hz)                                                                         
            case 'keyPad_btnZC': retVal = 1 / (120 * Math.PI * x); break;
            // ZL (60Hz)                                                                         
            case 'keyPad_btnZL': retVal = 120 * Math.PI * x; break;
            // Zc (50 Hz)                                                                          
            case 'keyPad_btnZC50': retVal = 1 / (100 * Math.PI * x); break;
            // ZL (50Hz)                                                                          
            case 'keyPad_btnZL50': retVal = 100 * Math.PI * x; break;
            // F->w                                                                            
            case 'keyPad_btnF2W': retVal = 2 * Math.PI * x; break;
            // w->F                                                                           
            case 'keyPad_btnW2F': retVal = x / (2 * Math.PI); break;

            default: break;
        }
        boolClear = true;
        oscInBox.val(retVal);
        oscInBox.focus();
    });

    // *********************************************************
    // COMMAND BUTTONS: BACKSPACE, CLEAR AND ALL CLEAR
    $("div#keyPad button.keyPad_btnCommand").click(function () {
        var inBox = $('input#keyPad_UserInput');
        var mem = $('input#keyPad_Mem');
        var strInput = inBox.val();

        switch (this.id) {
            // on ENTER (=) calculate the result, clear opCode                                                           
            case 'keyPad_btnEnter':
                oscBinaryOperation(); opCode = 0; break;
            // clear input box (if not empty) or opCode            
            case 'keyPad_btnClr':
                if (strInput == strEmpty) { opCode = 0; boolClear = false; }
                else { inBox.val(strEmpty); }
                break;
            // clear the last char if input box is not empty                                                                   
            case 'keyPad_btnBack': if (strInput.length > 0) {
                    inBox.val(strInput.substring(0, strInput.length - 1)); break;
                }
                // clear all          
            case 'keyPad_btnAllClr':
                inBox.val(strEmpty);
                stackVal = strEmpty;
                mem.val(strEmpty);
                opCode = 0;
                break;
            default: break;
        }
    });

    // MEMORY OPERATIONS **************************************
    $("div#keyPad button.keyPad_btnMemOp").click(function () {
        var inBox = $('input#keyPad_UserInput');
        var mem = $('input#keyPad_Mem');
        var dInbox = strEmpty;
        var dMem = strEmpty;

        // move input value to mem
        if (this.id == 'keyPad_btnToMem') {
            // input box validation: must be not empty & Finite & not NaN
            if (IsEmpty(inBox.val())) { return; }
            if (!IsValidString(inBox.val())) { inBox.val(strEmpty); return; }
            mem.val(inBox.val());
            boolClear = true;
        }

        // move mem value to input box
        if (this.id == 'keyPad_btnFromMem') { inBox.val(mem.val()); return; }

        // validate and parse input box
        if (IsEmpty(inBox.val())) { return; }
        if (!IsValidString(inBox.val())) { inBox.val(strEmpty); return; }
        dInbox = parseFloat(inBox.val());

        // validate and parse memory box: convert to zero if not valid
        if (IsEmpty(mem.val())) { mem.val(0) }
        if (!IsValidString(mem.val())) { mem.val(0) }
        dMem = parseFloat(mem.val());

        // *** perform arithmetic operations w/memory
        switch (this.id) {
            // add to mem                                               
            case 'keyPad_btnMemPlus': mem.val(dMem + dInbox); break;
            // subtract from mem                                                
            case 'keyPad_btnMemMinus': mem.val(dMem - dInbox); break;
            default: break;
        }
        boolClear = true;
    });

    // CLEAR MEM BOX BY CLICKING ON IT
    $("div#keyPad input.keyPad_TextBox").click(function () {
        switch (this.id) {
            case 'keyPad_Mem': $('input#keyPad_Mem').val(strEmpty); break;
            default: break;
        }
    });

    // E-SERIES OPERATIONS **************************************
    $("div#keyPad button.keyPad_btnESeries").click(function () {
        switch (this.id) {
            case 'keyPad_btnE6': BuildTableE("E6", _tab); break;
            case 'keyPad_btnE12': BuildTableE("E12", _tab); break;
            case 'keyPad_btnE24': BuildTableE("E24", _tab); break;
            case 'keyPad_btnE48': BuildTableE("E48", _tab); break;
            case 'keyPad_btnE96': BuildTableE("E96", _tab); break;
            case 'keyPad_btnE192': BuildTableE("E192", _tab); break;
            case 'keyPad_btnCe': ClearTableE(_tab); break;
            default: break;
        }
    });

    // ** E-SERIES TABLE **
    function BuildTableE(xmlTag, tabOut) {

        // check if E-Series already opened
        if (_seriesOpened.indexOf(xmlTag) > -1) return;
        _seriesOpened.push(xmlTag);

        // get E-Series by tag from XML file
        var arrSeries = xmlDocE.getElementsByTagName(xmlTag);

        // get array of values corresponding to E-Series
        var arrItems = arrSeries[0].getElementsByTagName("value");

        // E-SERIES header
        tabOut.last().append("<tr><th>" + xmlTag + "</th></tr>");

        // values, 6 in row
        for (i = 0; i < arrItems.length; i++) {
            try {
                var _str = "<tr>";
                for (j = 0; j < 6; j++) {
                    _str = _str + "<td>" + arrItems[i * 6 + j].childNodes[0].nodeValue + "</td>";
                }
                _str = _str + "</tr>";
                tabOut.last().append(_str);
            }
            catch (ex) { break; }
        }
    }
    // Clear E-Series Table
    function ClearTableE(tabOut) { tabOut.empty(); _seriesOpened.length = 0;}

    // ** AUX FUNCTIONS **
    // validate that isFinite and not NaN
    function IsValidString(str) {
        if ((!isNaN(str)) && (isFinite(str))) { return (true); } return (false);
    }
    // string empty test
    function IsEmpty(str) { if (str.length > 0) { return (false); } return true; }

    // validate and format stack
    function IsStackValid() {
        if (!isNaN(stackVal) && isFinite(stackVal)) { return (true); } return (false);
    }
})
