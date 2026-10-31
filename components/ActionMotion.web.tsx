const button='[data-motion="button"]:not(:has([data-motion="button"]))';
const css=`
${button}{transition:translate 160ms ease,scale 160ms ease,box-shadow 160ms ease,background-color 160ms ease,opacity 120ms ease;cursor:pointer;}
@media(hover:hover) and (pointer:fine){${button}:hover{translate:0 -1px;scale:1.025;box-shadow:0 5px 15px #5143c21c;}}
${button}:active{translate:0 0;scale:.97;}
${button}:focus-visible{outline:3px solid #a891ff;outline-offset:3px;}
@media(prefers-reduced-motion:reduce){${button}{transition:none;translate:none!important;scale:none!important;}}
`;
export function ActionMotion(){return <style>{css}</style>;}
