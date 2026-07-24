window.SiteConfig = (function () {
  const projectPath = '';//'lotusluminous';
  const basePath = `${projectPath}`;//`/${projectPath}`;

  function assetPath(path) {
    return `${basePath}/${String(path).replace(/^\/+/, '')}`;
  }

  return Object.freeze({
    projectPath,
    basePath,
    catalogPath: assetPath('content/catalog.json'),
    assetPath,
  });
})();
