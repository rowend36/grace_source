_Define(function(global) {
    var Notify = global.Notify;
    var table = global.Tabulate;
    function Thumbnail(el) {

    }

    function preview(filename,ondismiss) {
        var el = Notify.modal({
            header: filename,
            body: "<div class='preview-content'></div>"
        },ondismiss);
        return el;
    }
    var ONE_MB = global.Utils.parseSize('1mb');
    function previewImage(ev) {
        var url;
        var a = preview(ev.filepath,function(){
            if(url){
                URL.revokeObjectURL(url);
            }
        });
        var img = document.createElement("img");
        if(false && ev.browser.fileServer.href){
            img.src = ev.browser.fileServer.href+"/"+ev.filepath;
        }
        else{
            ev.filebrowser.fileServer.readFile(ev.filepath,function(e,res){
                if(false && res.length<ONE_MB){
                    img.src = "data:image/png;base64,"+Base64.encode(res);
                }
                else{
                    alert(url);
                    url = URL.createObjectURL(new Blob([res]));
                }
            });
            a.appendChild(img);
        }
    }
    var previewers = {
        "jpg": previewImage,
        "png": previewImage,
        "gif": previewImage,
        "jpeg": previewImage,
    };
    global.FileUtils.on('open-file',function(ev){
       if(global.FileUtils.isBinaryFile(ev.filename)){
           var ext = global.FileUtils.extname(ev.filename).toLowerCase();
           if (previewers[ext]) {
               ev.preventDefault();
               previewers[ext](ev);
           }
       }
    });
});