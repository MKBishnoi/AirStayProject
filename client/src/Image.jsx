export default function Image({src,...rest}) {
  src = src && src.includes('https://')
    ? src
    : 'http://localhost:4000/uploads/'+src;
  return (
    <div {...rest}  style={{backgroundImage:`url(${src})`,width:"200px",height:'200px',backgroundSize:"200px 200px",borderRadius:'10px'}} />
  );
}