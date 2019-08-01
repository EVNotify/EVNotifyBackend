function doRequest() {
    var request = new XMLHttpRequest();
    request.onreadystatechange = function () {
        if (this.readyState == 4) {
            if (this.status >= 200 && this.status < 300) {
                document.getElementById("success").style.display = "block";
            } else {
                var errorDiv = document.getElementById("error" + this.status);
                if (errorDiv) {
                    errorDiv.style.display = "block";
                } else {
                    document.getElementById("error").appendChild(document.createTextNode(request.responseText));
                    document.getElementById("error").style.display = "block";
                }
            }
        }
    }
    request.open("post", ".", true);
    request.send();
    return false;
}