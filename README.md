# Explorador de Países

Proyecto de la clase de Diseño de Sistemas de Internet. Es un portal web que consume APIs públicas con fetch en JavaScript. Para el diseño usé Bootstrap 5.

Hecho por: Joel Oveth Arróliga Acevedo

## APIs que usé

- countries.dev: para los datos de los países (no pide API key). Al inicio iba a usar REST Countries como en el ejemplo, pero la versión 3.1 ya no funciona y la nueva pide registrarse.
- Open-Meteo: para mostrar el clima de la capital de cada país.

## Qué hace

- Muestra los países en tarjetas y se pueden buscar, filtrar por región y ordenar.
- Al darle clic a un país se abre un modal con más datos, los países con los que tiene frontera y el clima de la capital.
- Arriba se ve el estado de la petición (200, 404), cuánto tardó y a qué endpoint se hizo.
- En la parte del laboratorio se puede buscar un país usando async/await o con .then() y .catch(), igual que lo vimos en clase.
- Si el país no existe o no hay internet, muestra un mensaje de error.

## Cómo correrlo

Abrir el index.html en el navegador o con Live Server en VS Code. Necesita internet para cargar Bootstrap y las APIs.

## Ejemplo de cómo consumo la API

```js
async function buscarPais() {
  try {
    const respuesta = await fetch('https://countries.dev/name/nicaragua');
    if (!respuesta.ok) throw new Error('Error HTTP: ' + respuesta.status);
    const datos = await respuesta.json();
    console.log(datos[0].name, datos[0].capital);
  } catch (error) {
    console.error(error.message);
  }
}
```