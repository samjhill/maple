require('dotenv').config();

const zipper = require("zip-local");
const uplink = require("uplink-nodejs");
const libUplink = new uplink.Uplink();
const fs = require('fs');

const BUFFER_SIZE = 80000;

const storjConfig = {
  apiKey: process.env.TARDIGRADE_KEY,
  satelliteURL: "us-central-1.tardigrade.io:7777",
  encryptionPassphrase: "test",
  bucketName: "nodejstest",
};

const zipDirectory = (source, out) => {
  return zipper.sync.zip(source).compress().save(out);
};

const uploadWrite = async (project, filePath, fileName) => {
  const uploadOptions = new uplink.UploadOptions();

  return await project.uploadObject(storjConfig.bucketName, fileName, uploadOptions).then(async (upload) => {
    const fileHandle = fs.openSync(filePath, "rs");
    const size = {
      file: `${fs.statSync(filePath).size}`,
      toWrite: 0,
      actuallyWritten: 0,
      totalWritten: 0
    };

    let buffer = new Buffer.alloc(BUFFER_SIZE);
    let loop = true;
    let bytesRead = 0;

    while (loop) {
      size.toWrite = size.file - size.totalWritten;

      if (size.toWrite > BUFFER_SIZE) {
        size.toWrite = BUFFER_SIZE;
      } else if (size.toWrite === 0) {
        break;
      }

      bytesRead = fs.readSync(fileHandle, buffer, 0, size.toWrite, size.totalWritten);

      //
      //Write data to storj V3 network
      await upload.write(buffer, bytesRead).then(writeResult => {
        size.actuallyWritten = writeResult.bytes_written;
        size.totalWritten = size.totalWritten + size.actuallyWritten;
        if((size.totalWritten > 0) && (size.file > 0)){
            console.log("File Uploaded On Storj: ",((Number(size.totalWritten)/Number(size.file))*100).toFixed(4)," %");
        }
      }).catch(err => {
        console.log("Failed to write data on storj V3 network");
        console.log(err);
        loop = false;
      });
      if (size.totalWritten >= size.file ){
        break;
      }
    }

    fs.closeSync(fileHandle);
    
    return await upload.commit().then(() => {
        console.log("\nObject stored on storj V3 network successfully");
        console.log("file size: ", size.file);
    }).catch((err) => {
        console.log("Failed to commit object on storj V3 network");
        console.log(err);
    });
  });
};

const connect = async () => {
  return await libUplink.requestAccessWithPassphrase(storjConfig.satelliteURL,storjConfig.apiKey,storjConfig.encryptionPassphrase).then(async (access) => {
    console.log('✅ successfully connected to Tardigrade');
    return access;
  }).catch(e => console.error(e));
};

const createBucket = async (project) => {
  return await project.createBucket(storjConfig.bucketName).then(async (bucketInfo) => {
    return bucketInfo;
  }).catch(e => console.error(e));
};

const listBuckets = async (project) => {
  var listBucketsOptions = new uplink.ListBucketsOptions();
  return await project.listBuckets(listBucketsOptions).then(async (bucketListResult) => {
    return Object.entries(bucketListResult.bucketList).map(([,result]) => result.name);
  });
};

const listObjects = async (project) => {
  var listObjectsOptions = new uplink.ListObjectsOptions();
  return await project.listObjects(storjConfig.bucketName, listObjectsOptions).then(async (objectlist) => {
    Object.entries(objectlist).map(([key, entry]) => console.log(entry))
    return objectlist;
  })
};

const openProject = async(accessResult) => {
  return await accessResult.openProject().then(async (project) => {
    return project;
  }).catch(e => console.error(e));
};

connect().then(
  accessResult => {
    openProject(accessResult).then(async project => {
      const buckets = await listBuckets(project);
      if (!buckets.includes(storjConfig.bucketName)) {
        await createBucket(project);
      }
      const archiveName = `${new Date().toISOString()}.zip`;
      zipDirectory(__dirname + '/bin/exampleData/', __dirname + `/bin/${archiveName}`);
      await uploadWrite(project, __dirname + `/bin/${archiveName}`, archiveName).then(() => console.log('Finished uploading!'));
      listObjects(project);
    });
  }
);
