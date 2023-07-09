function handler(event) {
  var request = event.request;

  // Extract the URI from the request
  var olduri = request.uri;

  // Match any '/' that occurs at the end of a URI. Replace it with a default index
  var newuri = olduri.replace(/\/$/, "/index.html");

  // Replace the received URI with the URI that includes the index page
  request.uri = newuri;

  return request;
}
