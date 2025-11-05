// semua JavaScript logic dari file sebelumnya
const display = document.getElementById("display");
const historyContent = document.getElementById("history-content");
let historyArr = [];
let memory = 0;

function appendValue(val){display.value+=val;}
function appendFunction(func){display.value+=func+'(';}
// ... dan seterusnya
