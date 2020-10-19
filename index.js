require('dotenv').config();

const zipper = require("zip-local");
const uplink = require("uplink-nodejs");
const libUplink = new uplink.Uplink();
const fs = require('fs');

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
  const data = fs.readFileSync(filePath);
  const stats = fs.statSync(filePath);
  const fileSizeInBytes = stats.size;

  return await project.uploadObject(storjConfig.bucketName, fileName, uploadOptions).then(async (upload) => {
    return await upload.write(data, fileSizeInBytes).then(async (uploadData) => {
      console.log('uploadData', uploadData)
      return await upload.commit().then(async result => {
        console.log('commit result', result)
        return await upload.info().then(object => console.log('Uploaded: ', object));
      });
    }).catch(e => console.error(e));
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
