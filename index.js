require('dotenv').config();
const express = require('express');
const pool = require('./db');

const app = express();
app.use(express.json());

const GENEROS = ['Novela', 'Infantil', 'Ciencia', 'Tecnología', 'Historia'];

function validarLibro(datos) {
  const errores = [];
  const { isbn, titulo, autor, genero, anio_publicacion, paginas, ejemplares } = datos;
  const anioActual = new Date().getFullYear();

  if (typeof isbn !== 'string' || !/^\d{13}$/.test(isbn)) {
    errores.push('El ISBN debe tener 13 números');
  }

  if (typeof titulo !== 'string' || titulo.trim().length < 3 || titulo.trim().length > 150) {
    errores.push('El título es obligatorio y debe tener entre 3 y 150 caracteres');
  }

  if (typeof autor !== 'string' || !/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ ]+$/.test(autor) || autor.trim() === '') {
    errores.push('El autor solo puede tener letras y espacios');
  }

  if (!GENEROS.includes(genero)) {
    errores.push('El género debe ser: Novela, Infantil, Ciencia, Tecnología o Historia');
  }

  if (!Number.isInteger(anio_publicacion) || anio_publicacion < 1500 || anio_publicacion > anioActual) {
    errores.push(`El año de publicación debe estar entre 1500 y ${anioActual}`);
  }

  if (!Number.isInteger(paginas) || paginas < 1 || paginas > 5000) {
    errores.push('Las páginas deben estar entre 1 y 5000');
  }

  if (!Number.isInteger(ejemplares) || ejemplares < 0 || ejemplares > 100) {
    errores.push('Los ejemplares deben estar entre 0 y 100');
  }

  return errores;
}

const idValido = (id) => /^\d+$/.test(id);

app.get('/api/libros', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM libros ORDER BY id');
    res.status(200).json(result.rows);
  } catch (err) {
    next(err);
  }
});


app.get('/api/libros/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!idValido(id)) return res.status(404).json({ mensaje: 'Libro no encontrado' });

    const result = await pool.query('SELECT * FROM libros WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ mensaje: 'Libro no encontrado' });
    }
    res.status(200).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});


app.post('/api/libros', async (req, res, next) => {
  try {
    const errores = validarLibro(req.body);
    if (errores.length > 0) return res.status(400).json({ errores });

    const { isbn, titulo, autor, genero, anio_publicacion, paginas, ejemplares } = req.body;
    const disponible = ejemplares > 0; 

    const result = await pool.query(
      `INSERT INTO libros (isbn, titulo, autor, genero, anio_publicacion, paginas, ejemplares, disponible)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [isbn, titulo.trim(), autor.trim(), genero, anio_publicacion, paginas, ejemplares, disponible]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ mensaje: 'Ya existe un libro con ese ISBN' });
    }
    next(err);
  }
});


app.put('/api/libros/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!idValido(id)) return res.status(404).json({ mensaje: 'Libro no encontrado' });

    const existe = await pool.query('SELECT id FROM libros WHERE id = $1', [id]);
    if (existe.rows.length === 0) {
      return res.status(404).json({ mensaje: 'Libro no encontrado' });
    }

    const errores = validarLibro(req.body);
    if (errores.length > 0) return res.status(400).json({ errores });

    const { isbn, titulo, autor, genero, anio_publicacion, paginas, ejemplares } = req.body;
    const disponible = ejemplares > 0;

    const result = await pool.query(
      `UPDATE libros
       SET isbn = $1, titulo = $2, autor = $3, genero = $4,
           anio_publicacion = $5, paginas = $6, ejemplares = $7, disponible = $8
       WHERE id = $9 RETURNING *`,
      [isbn, titulo.trim(), autor.trim(), genero, anio_publicacion, paginas, ejemplares, disponible, id]
    );
    res.status(200).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ mensaje: 'Ya existe un libro con ese ISBN' });
    }
    next(err);
  }
});


app.delete('/api/libros/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!idValido(id)) return res.status(404).json({ mensaje: 'Libro no encontrado' });

    const libro = await pool.query('SELECT disponible FROM libros WHERE id = $1', [id]);
    if (libro.rows.length === 0) {
      return res.status(404).json({ mensaje: 'Libro no encontrado' });
    }

    
    if (libro.rows[0].disponible === false) {
      return res.status(409).json({ mensaje: 'No se puede eliminar un libro no disponible' });
    }

    await pool.query('DELETE FROM libros WHERE id = $1', [id]);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});


app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ errores: ['El formato no es válido'] });
  }
  console.error(err);
  res.status(500).json({ mensaje: 'Error interno del servidor' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor listo en el puerto ${PORT}`);
});