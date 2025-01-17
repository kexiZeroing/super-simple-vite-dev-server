export const removeQuery = (url) => {
  return url.split("?")[0];
};

export const getQuery = (url, key) => {
  const searchParams = url.includes('?') 
    ? new URLSearchParams(url.split('?')[1])
    : new URLSearchParams('');
  return searchParams.get(key);
};

export const checkQueryExist = (url, key) => {
  const searchParams = url.includes('?') 
    ? new URLSearchParams(url.split('?')[1])
    : new URLSearchParams('');
  return searchParams.has(key);
};

export const cssToJsResponse = (css) => {
  return `
    const insertStyle = (css) => {
      let el = document.createElement('style')
      el.setAttribute('type', 'text/css')
      el.innerHTML = css
      document.head.appendChild(el)
    }
    insertStyle(\`${css}\`)
    export default insertStyle
  `;
};

export const isStaticAsset = (url) => {
  // only consider images
  return /\.(png|jpe?g|gif|svg|ico|webp)(\?.*)?$/.test(url);
};
