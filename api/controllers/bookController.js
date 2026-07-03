const {pool} = require("../database/connection");

async function getBooks(req , res){
 try {
     const [rows] = await pool.query(`SELECT * FROM livros;`);

     return res.status(200).json(rows);

 } catch (error) {
     console.log(error);
     return res.status(500).json({
          error : "Error getting books"
     });
 }
}
async function getBookById(req , res){
    const {id} = req.params;

    try {
       const [rows] = await pool.query(
        `SELECT * FROM livros WHERE id_livro = ?;`, [id]
       );
       return res.status(200).json(rows[0]);
    }catch(error){
       console.log(error);
       return res.status(500).json({
        error: "error getting book"
    });
    }
}


async function createBook(req , res){
 const { titulo, autor, disponivel } = req.body;

  if (!titulo) {
    return res.status(400).send('O título do livro é obrigatório.');
  }
  if (!autor) {
    return res.status(400).send('O autor do livro é obrigatório.');
  }


  try {
     
    const [result] = await pool.query(
      'INSERT INTO livros (titulo, autor, disponivel) VALUES (?, ?, ?)',
      [titulo, autor, disponivel  ?? true] 
    );

    
    const novoLivro = { id: result.insertId, titulo, autor, disponivel: disponivel ?? true };
    res.status(201).json(novoLivro); 
  } catch (error) {
    console.error('Erro ao adicionar novo livro:', error);
    res.status(500).send('Erro interno do servidor ao adicionar novo livro.');
  }
};


async function updateBook(req , res){
 const id = parseInt(req.params.id);
  const { titulo, autor, disponivel } = req.body;

  if (isNaN(id)) {
    return res.status(400).send('ID inválido. O ID deve ser um número.');
  }
 if (
  titulo === undefined &&
  autor === undefined &&
  disponivel === undefined
) {
  return res.status(400).json({
    error: "Pelo menos um campo deve ser fornecido para atualização."
  });
}

  try {
    
    const [existingRows] = await pool.query('SELECT * FROM livros WHERE id_livro = ?', [id]);
    if (existingRows.length === 0) {
      return res.status(404).send('livro não encontrado para atualização.');
    }

   
    let updates = [];
    let params = [];
    if (titulo !== undefined) {
      updates.push('titulo = ?');
      params.push(titulo);
    }
    if (autor !== undefined) {
      updates.push('autor = ?');
      params.push(autor);
    }
    if (disponivel !== undefined) {
      updates.push('disponivel = ?');
      params.push(disponivel);
    }

    if (updates.length === 0) { 
        return res.status(400).send('Nenhum campo válido para atualização fornecido.');
    }

    const query = `UPDATE livros SET ${updates.join(', ')} WHERE id_livro = ?`;
    params.push(id); 

    const [result] = await pool.query(query, params);

    if (result.affectedRows > 0) {
      
      const [updatedRows] = await pool.query('SELECT * FROM livros WHERE id_livro = ?', [id]);
      res.json(updatedRows[0]);
    } else {
      
      res.status(404).send('livro não encontrado ou nenhum dado foi alterado.');
    }
  } catch (error) {
    console.error(`Erro ao atualizar livro com ID ${id}:`, error);
    res.status(500).send('Erro interno do servidor ao atualizar livro.');
  }
}

async function deleteBook(req , res){
const id = parseInt(req.params.id);

  if (isNaN(id)) {
    return res.status(400).send('ID inválido. O ID deve ser um número.');
  }

  try {
    const [result] = await pool.query('DELETE FROM livros WHERE id_livro = ?', [id]);

    if (result.affectedRows > 0) { 
      res.status(204).send();
    } else {
      res.status(404).send('livro não encontrado para exclusão.');
    }
  } catch (error) {
    console.error(`Erro ao excluir livro com ID ${id}:`, error);
    res.status(500).send('Erro interno do servidor ao excluir livro.');
  }
}


module.exports = {
    getBooks,
    getBookById,
    createBook,
    updateBook,
    deleteBook
}