import express from 'express';
import serveIndex from 'serve-index';
import fileUpload from 'express-fileupload';
import cors from 'cors';
import { log } from './utils';
import Injector from './injector';
import {
  InputData,
  errorMiddleware,
  fetchAllFileContents,
  fetchAllFileUrls,
  FileObject,
  NotFound, 
  getChainId,
  verify,
} from "./utils";
import dotenv from 'dotenv';

const app = express();
dotenv.config();

let localChainUrl;

if (process.env.TESTING) {
  localChainUrl = process.env.LOCALCHAIN_URL;
}

const injector = new Injector({
    localChainUrl: localChainUrl,
    log: log
});

const repository = process.env.MOCK_REPOSITORY || './repository';
const port = process.env.SERVER_PORT;

app.use(express.static('ui/dist'))

// TODO: 52MB is the max file size - is this right?
app.use(fileUpload({
  limits: {fileSize: 50 * 1024 * 1024},
  abortOnLimit: true
}))

app.use(cors())

/* tslint:disable:no-unused-variable */
app.get('/', (req, res) => res.sendFile('ui/dist/index.html'))
app.get('/health', (req, res) => res.status(200).send('Alive and kicking!'))
app.use('/repository', express.static(repository), serveIndex(repository, {'icons': true}))

app.get('/tree/:chain/:address', (req, res, next) => {
  try {
    const chain:string = req.params.chain;
    const address: string = req.params.address;
    const chainId = getChainId(chain);
    const files = fetchAllFileUrls(chainId, address);
    if(!files.length) throw new NotFound("Files have not been found!");
    res.status(200).send(JSON.stringify(files))
  } catch(err){
    next(err);
  }
})

app.get('/files/:chain/:address', (req, res, next) => {
  try{
    const chain:string = req.params.chain;
    const address: string = req.params.address;
    const chainId = getChainId(chain);
    const files: Array<FileObject> = fetchAllFileContents(chainId, address);
    if(files.length === 0) throw new NotFound("Files have not been found!");
    res.status(200).send(files);
  } catch(err) {
    next(err);
  }
})

/* tslint:enable:no-unused-variable */
app.post('/', (req, res, next) => {
  const inputData: InputData = {
    repository: repository,
    files: req.files,
    addresses: [req.body.address],
    chain: getChainId(req.body.chain)
  }

  try{
    Promise.all(verify(inputData, injector)).then((result) => {
      res.status(200).send({
        result
      })
    }).catch(err => {
      next(err)
    });
  } catch (err) {
    return next(err);
  }
})

app.use(errorMiddleware);

app.listen(port, () => log.info({loc: '[LISTEN]'}, `Injector listening on port ${port}!`))

export default app;
